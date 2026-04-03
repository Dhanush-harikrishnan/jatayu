import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Clock, AlertTriangle, CheckCircle, X,
  Monitor, Smartphone, Wifi, 
  Maximize2, Minimize2, User
} from 'lucide-react';
import { cn, getViolationDescription } from '@/lib/utils';
import { fetchApi, API_BASE_URL } from '@/lib/api';
import { io as socketIO, Socket } from 'socket.io-client';

interface LiveProctoringProps {
  examId?: string;
}

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
}

interface Violation {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  evidenceKey?: string;
}

export function LiveProctoring({ examId = 'EXAM-101' }: LiveProctoringProps) {
  const [QUESTIONS, setQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

  useEffect(() => {
    fetchApi(`/api/questions/${examId}`)
      .then(res => res.json())
      .then(data => {
        setQuestions(Array.isArray(data) && data.length > 0 ? data : []);
        setIsLoadingQuestions(false);
      })
      .catch(err => {
        console.error("Failed to load questions:", err);
        setIsLoadingQuestions(false);
      });
  }, [examId]);
  const [sessionTime, setSessionTime] = useState(() => {
    const savedPolicyRaw = localStorage.getItem(`examPolicy:${examId}`);
    if (!savedPolicyRaw) return 3600;
    try {
      const parsed = JSON.parse(savedPolicyRaw) as { duration?: number };
      if (typeof parsed.duration === 'number' && parsed.duration > 0) {
        return Math.floor(parsed.duration * 60);
      }
      return 3600;
    } catch {
      return 3600;
    }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [requireFullscreen] = useState(() => {
    const savedPolicyRaw = localStorage.getItem(`examPolicy:${examId}`);
    if (!savedPolicyRaw) return true;
    try {
      const parsed = JSON.parse(savedPolicyRaw) as { requireFullscreen?: boolean };
      return parsed.requireFullscreen !== false;
    } catch {
      return true;
    }
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Real ML integration states
  const [realViolations, setRealViolations] = useState<Violation[]>([]);
  const [telemetryState, setTelemetryState] = useState({
    faceDetected: true,
    faceConfidence: 99,
  });

  // MCQ State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileFrame, setMobileFrame] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const noFaceStrikeRef = useRef(0);
  const allowNavigationRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  const addToast = useCallback((toast: Toast) => {
    setToasts(prev => [toast, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 5000);
  }, []);

  // Connect socket.io so the backend correlation engine gets frames and
  // the explicit 'end-exam' event can be sent when the student finishes.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = socketIO(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('LiveProctoring socket connected:', socket.id);
      socket.emit('exam-started-by-primary');
    });

    socket.on('mobile_feed_frame', (data: { imageBase64: string }) => {
      setMobileFrame(data.imageBase64);
    });

    socket.on('mobile_violation', (data: { violationType: string; timestamp: string; s3Key?: string }) => {
      const mobileDescriptions: Record<string, string> = {
        'PHONE_DETECTED': 'Phone detected by secondary camera',
        'BOOK_DETECTED': 'Book or document detected by secondary camera',
        'MULTIPLE_LAPTOPS_DETECTED': 'Multiple laptops detected by secondary camera',
        'PHONE_MOVEMENT_DETECTED': 'Significant phone movement detected',
        'MULTIPLE_PERSONS_DETECTED_MOBILE': 'Multiple persons detected by secondary camera',
      };
      const description = mobileDescriptions[data.violationType] || `Secondary camera: ${data.violationType}`;
      const newViolation: Violation = {
        id: `mobile_${Date.now()}`,
        type: data.violationType,
        severity: (data.violationType === 'PHONE_DETECTED' || data.violationType === 'BOOK_DETECTED') ? 'high' : 'medium',
        timestamp: data.timestamp,
        evidenceKey: data.s3Key,
      };
      setRealViolations(prev => [newViolation, ...prev]);
      addToast({
        id: newViolation.id,
        type: 'warning',
        title: 'Secondary Camera Alert',
        message: description,
      });
    });

    socket.on('session-terminated', (data: { reason: string }) => {
      addToast({
        id: `terminated_${Date.now()}`,
        type: 'error',
        title: 'Session Terminated',
        message: data.reason || 'Your exam session has been terminated by the administrator.',
      });
      // Force redirect after short delay
      setTimeout(() => {
        allowNavigationRef.current = true;
        window.location.href = '/dashboard';
      }, 3000);
    });

    socket.on('connect_error', (err) => {
      console.error('LiveProctoring socket error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addToast]);

  // Tab-Switch and Copy-Paste Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (socketRef.current?.connected) {
          socketRef.current.emit('tab_switch', { timestamp: Date.now() });
        }
        setRealViolations(prev => [{
          id: Date.now().toString(),
          type: 'tab_switch',
          severity: 'medium',
          timestamp: new Date().toISOString(),
        } as Violation, ...prev]);
        
        addToast({
          id: Date.now().toString(),
          type: 'warning',
          title: 'Tab Switch Detected',
          message: 'Leaving the exam tab is not permitted and has been logged.',
        });
      }
    };

    const blockCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      
      if (socketRef.current?.connected) {
        socketRef.current.emit('copy_paste', { timestamp: Date.now() });
      }
      setRealViolations(prev => [{
        id: Date.now().toString(),
        type: 'copy_paste',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      } as Violation, ...prev]);

      addToast({
        id: Date.now().toString(),
        type: 'warning',
        title: 'Clipboard Action Blocked',
        message: 'Copying/pasting is strictly prohibited during the exam.',
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', blockCopyPaste);
    document.addEventListener('paste', blockCopyPaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', blockCopyPaste);
      document.removeEventListener('paste', blockCopyPaste);
    };
  }, [addToast]);

  // Session timer & navigation protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) {
        return;
      }
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the active exam? Your progress may be lost and a violation may be recorded.';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const timer = setInterval(() => {
        setSessionTime(t => (t > 0 ? t - 1 : 0));
    }, 1000);

    return () => {
        clearInterval(timer);
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [examId]);

  useEffect(() => {
    if (!requireFullscreen) return;

    const ensureFullscreen = async () => {
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        } catch (err) {
          console.error('Fullscreen request denied:', err);
        }
      }
    };

    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        addToast({
          id: Date.now().toString(),
          type: 'warning',
          title: 'Fullscreen Required',
          message: 'Returning to fullscreen for secure exam mode.',
        });
        void ensureFullscreen();
      }
    };

    void ensureFullscreen();
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [requireFullscreen, addToast]);

  // Camera initialization
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(console.error);

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Real-time AWS ML Frame Analysis loop
  useEffect(() => {
    const captureAndAnalyze = async () => {
      // Don't analyze while an alert is actively blocking the screen
      if (realViolations.length > 0) return;
      if (!videoRef.current || !mediaStreamRef.current) return;
      if (videoRef.current.readyState < 2) return;

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async () => {
        try {
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
          const analyzeRes = await fetchApi(`/exam/${examId}/analyze-live-frame`, {
            method: 'POST',
            body: JSON.stringify({ imageBase64 })
          });

          if (analyzeRes.violationDetected) {
            if (analyzeRes.violationType === 'face_not_detected') {
              noFaceStrikeRef.current += 1;
              if (noFaceStrikeRef.current < 2) {
                // Ignore one transient miss to reduce false positives while user is in frame.
                setTelemetryState(s => ({ ...s, faceDetected: true, faceConfidence: 75 }));
                return;
              }
            } else {
              noFaceStrikeRef.current = 0;
            }

            const newViolation: Violation = {
              id: Date.now().toString(),
              type: analyzeRes.violationType,
              severity:
                analyzeRes.violationType === 'phone_detected' ||
                analyzeRes.violationType === 'multiple_faces'
                  ? 'high'
                  : 'medium',
              timestamp: new Date().toISOString(),
              evidenceKey: analyzeRes.s3Key
            };

            setRealViolations(prev => [newViolation, ...prev]);

            addToast({
              id: newViolation.id,
              type: 'error',
              title: 'Security Violation Detected',
              message: getViolationDescription(analyzeRes.violationType)
            });

            if (analyzeRes.violationType === 'face_not_detected') {
              setTelemetryState({ faceDetected: false, faceConfidence: 0 });
            } else if (
              analyzeRes.violationType === 'multiple_faces' ||
              analyzeRes.violationType === 'phone_detected'
            ) {
              setTelemetryState(s => ({ ...s, faceDetected: true, faceConfidence: 50 }));
            } else if (analyzeRes.violationType === 'looking_away') {
              setTelemetryState(s => ({ ...s, faceDetected: true, faceConfidence: 70 }));
            }
          } else {
            noFaceStrikeRef.current = 0;
            // Update telemetry to healthy
            setTelemetryState({
              faceDetected: true,
              faceConfidence: 98 + Math.random(), // just a simulation of high confidence if no violation
            });
          }
        } catch (err) {
          console.error('Frame analysis failed:', err);
        }
      }, 'image/jpeg', 0.8);
    };

    const interval = setInterval(captureAndAnalyze, 3000); // Analyze every 3 seconds
    return () => clearInterval(interval);
  }, [examId, realViolations, addToast]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const clearViolations = () => {
    setRealViolations([]);
  };

  const toggleFullscreen = () => {
    if (requireFullscreen) {
      return;
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatSessionTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const submitExamToServer = async () => {
    setIsSubmitting(true);
    if (socketRef.current?.connected) {
      socketRef.current.emit('end-exam');
    }

    const sessionId = localStorage.getItem('sessionId');
    try {
      if (sessionId) {
        await fetchApi(`/exam/${examId}/submit`, {
          method: 'POST',
        });
      }

      addToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Exam Submitted',
        message: 'Your exam text has been auto-submitted. Report generation initiated.'
      });

      setTimeout(() => {
        allowNavigationRef.current = true;
        window.location.href = `/exam-report?sessionId=${sessionId}`; // Task 7 route
      }, 2000);

    } catch (error) {
      console.error('Failed to end exam and send report:', error);
      setTimeout(() => {
        allowNavigationRef.current = true;
        window.location.href = `/exam-report?sessionId=${sessionId}`;
      }, 2000);
    }
  };

  const handleEndExam = async () => {
    if (!window.confirm("Are you sure you want to finish and submit the exam? You cannot change your answers after submission.")) return;
    await submitExamToServer();
  };

  // Timer warnings and auto-submit
  useEffect(() => {
    if (sessionTime === 300) { // 5 minutes
      addToast({
        id: 'timer-warning-5min',
        type: 'warning',
        title: '5 Minutes Remaining',
        message: 'Please review your answers. The exam will be auto-submitted in 5 minutes.',
      });
    } else if (sessionTime === 0 && !isSubmitting) {
       addToast({
        id: 'timer-expired',
        type: 'error',
        title: 'Time is up',
        message: 'Auto-submitting your exam...',
      });
      void submitExamToServer();
    }
  }, [sessionTime, isSubmitting]);

  const currentQ = QUESTIONS[currentQuestionIdx];
  if (isLoadingQuestions) {
    return <div className="min-h-screen flex items-center justify-center font-sora p-8 text-xl">Loading exam questions...</div>;
  }
  
  if (!currentQ) {
    return <div className="min-h-screen flex items-center justify-center font-sora p-8 text-xl text-red-500">Error: Could not load questions for this exam.</div>;
  }


  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-50/90 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100/50">
              <Shield strokeWidth={1} className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="font-sora text-sm font-semibold text-slate-900">Introduction to Computer Science</h1>
              <p className="text-xs text-slate-500">Exam ID: {examId}</p>
            </div>
          </div>

          {/* Center Timer */}
          <div className="flex items-center gap-4">
            <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border", sessionTime <= 300 ? "bg-violation/10 border-violation/30" : "bg-white border-slate-200")}>
              <Clock strokeWidth={1} className={cn("h-4 w-4", sessionTime <= 300 ? "text-violation animate-pulse" : "text-blue-600")} />
              <span className={cn("font-mono text-lg font-semibold", sessionTime <= 300 ? "text-violation animate-pulse" : "text-slate-900")}>
                {formatSessionTime(sessionTime)}
              </span>
              <span className="text-xs text-slate-500"> remaining</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              disabled={requireFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFullscreen ? <Minimize2 strokeWidth={1} className="h-4 w-4" /> : <Maximize2 strokeWidth={1} className="h-4 w-4" />}
            </button>
            <button
              onClick={handleEndExam}
              disabled={isSubmitting}
              className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors shadow-[0_0_15px_rgba(46,204,113,0.3)]",
                  isSubmitting ? "bg-slate-200/50 text-slate-900/50" : "bg-slate-200 text-slate-900 hover:bg-slate-200-light"
              )}
            >
              <CheckCircle strokeWidth={1} className="h-4 w-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Finish Exam'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-white0 border-t border-slate-100 overflow-x-auto scrollbar-hide">
          <TelemetryBadge 
            icon={User} 
            label="Face" 
            value={`${Math.round(telemetryState.faceConfidence)}%`}
            status={telemetryState.faceDetected ? 'good' : 'error'}
          />
          <TelemetryBadge 
            icon={Monitor} 
            label="Screen" 
            value="Active"
            status="good"
          />
          <TelemetryBadge 
            icon={Wifi} 
            label="Network" 
            value="Excellent"
            status="good"
          />
        </div>
      </header>

      {/* Main Content Area - Split Layout */}
      <main className="flex-1 mt-32 mb-4 mx-4 flex gap-6 relative">
        {/* Left Side - The Exam Interface */}
        <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl p-8 flex flex-col relative z-10">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-sora font-semibold text-slate-900">Question {currentQuestionIdx + 1} of {QUESTIONS.length}</h2>
                <div className="flex space-x-1">
                    {QUESTIONS.map((_, idx) => (
                        <div key={idx} className={cn(
                            "w-8 h-2 rounded-full transition-colors",
                            idx === currentQuestionIdx ? "bg-blue-600" : 
                            answers[idx] !== undefined ? "bg-slate-200/60" : "bg-slate-100"
                        )} />
                    ))}
                </div>
            </div>

            <div className="flex-1">
                <p className="text-xl text-slate-900 leading-relaxed mb-8">{currentQ.text}</p>

                <div className="space-y-4">
                    {currentQ.options.map((opt: any, idx: number) => {
                        const isSelected = answers[currentQuestionIdx] === idx;
                        return (
                        <button
                            key={idx}
                            onClick={() => setAnswers({...answers, [currentQuestionIdx]: idx})}
                            className={cn(
                                "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group",
                                isSelected ? "bg-blue-100/50 border-blue-600 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                            )}
                        >
                            <span className={cn("text-lg", isSelected ? "text-blue-600 font-medium" : "text-slate-800")}>{opt}</span>
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                isSelected ? "border-blue-600" : "border-slate-300 group-hover:border-slate-1000"
                            )}>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                            </div>
                        </button>
                    )})}
                </div>
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
                <button
                    onClick={() => setCurrentQuestionIdx(i => Math.max(0, i - 1))}
                    disabled={currentQuestionIdx === 0}
                    className="px-6 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                {currentQuestionIdx < QUESTIONS.length - 1 ? (
                    <button
                        onClick={() => setCurrentQuestionIdx(i => i + 1)}
                        className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                        Next Question
                    </button>
                ) : (
                    <button
                        onClick={handleEndExam}
                        className="px-6 py-2.5 rounded-lg bg-slate-200 text-slate-900 font-bold hover:bg-slate-200-light shadow-[0_0_15px_rgba(46,204,113,0.3)] transition-colors"
                    >
                        Review & Submit
                    </button>
                )}
            </div>
        </div>

        {/* Right Side - Picture-in-Picture feeds */}
        <div className="w-72 flex flex-col gap-4 relative z-10 flex-shrink-0">
          {/* Main Web Camera PiP */}
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-white border-2 border-slate-300 shadow-md border-slate-300 relative group">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Top right label */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50/80 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-violation animate-pulse" />
                <span className="text-[10px] text-slate-800 font-medium tracking-wider uppercase">Live Feed</span>
            </div>
            
            {/* Outline box mimicking face detection */}
            {telemetryState.faceDetected && (
              <div className="absolute inset-x-8 inset-y-6 border border-blue-400 rounded-lg shadow-[inset_0_0_20px_rgba(0,240,255,0.1)] pointer-events-none" />
            )}
          </div>
          
          {/* Real Mobile Feed PiP */}
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-white border-2 border-slate-300 shadow-md border-slate-300 relative group">
            {mobileFrame ? (
              <img src={mobileFrame} alt="Mobile Camera Feed" className="w-full h-full object-cover" />
            ) : (
             <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-white flex items-center justify-center">
                <div className="text-center opacity-50">
                    <Smartphone strokeWidth={1} className="h-8 w-8 text-slate-400 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs text-slate-500">Waiting for Secondary Camera...</p>
                </div>
             </div>
            )}
             <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50/80">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-[10px] text-slate-800 font-medium tracking-wider uppercase">Secondary Feed</span>
            </div>
          </div>

        </div>
      </main>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[320px] max-w-md',
                toast.type === 'error' && 'bg-violation/90 text-slate-900',
                toast.type === 'warning' && 'bg-warning/90 text-slate-900',
                toast.type === 'success' && 'bg-slate-200/90 text-slate-900',
                toast.type === 'info' && 'bg-blue-600/90 text-slate-900'
              )}
            >
              {toast.type === 'error' && <AlertTriangle strokeWidth={1} className="h-5 w-5 flex-shrink-0" />}
              {toast.type === 'warning' && <AlertTriangle strokeWidth={1} className="h-5 w-5 flex-shrink-0" />}
              {toast.type === 'success' && <CheckCircle strokeWidth={1} className="h-5 w-5 flex-shrink-0" />}
              {toast.type === 'info' && <AlertTriangle strokeWidth={1} className="h-5 w-5 flex-shrink-0" />}
              
              <div className="flex-1">
                <p className="font-medium text-sm">{toast.title}</p>
                {toast.message && (
                  <p className="text-sm opacity-90 mt-0.5">{toast.message}</p>
                )}
              </div>
              
              <button
                onClick={() => removeToast(toast.id)}
                className="text-current opacity-60 hover:opacity-100"
              >
                <X strokeWidth={1} className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Blocking Violation Alert Overlay */}
      <AnimatePresence>
        {realViolations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-50/80 backdrop-blur-md flex items-center justify-center pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-8 rounded-2xl max-w-lg w-full mx-4 border border-violation shadow-[0_0_50px_rgba(255,71,87,0.3)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-violation" />
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full bg-violation/10 flex items-center justify-center animate-pulse mb-6">
                  <AlertTriangle strokeWidth={1} className="h-10 w-10 text-violation" />
                </div>
                
                <h3 className="font-sora text-3xl font-bold text-slate-900 mb-2">Automated Alert</h3>
                <p className="text-xl text-violation font-medium mb-6">
                    {getViolationDescription(realViolations[0].type)}
                </p>
                
                <div className="bg-white p-4 rounded-xl mb-8 w-full">
                    <p className="text-slate-800 text-sm">
                        This incident has been logged and recorded by the proctoring system. Continued violations may result in immediate termination of the exam.
                    </p>
                </div>
              
                <button 
                  onClick={clearViolations}
                  className="w-full py-4 rounded-xl bg-violation text-slate-900 font-bold text-lg hover:bg-violation/90 transition-colors shadow-lg shadow-violation/20"
                >
                  I Understand & Resume Exam
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TelemetryBadgeProps {
  icon: React.ElementType;
  label: string;
  value: string;
  status: 'good' | 'warning' | 'error';
}

function TelemetryBadge({ icon: Icon, label, value, status }: TelemetryBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-100 flex-shrink-0">
      <Icon className={cn(
        'h-3.5 w-3.5',
        status === 'good' ? 'text-slate-500' :
        status === 'warning' ? 'text-warning' : 
        'text-violation'
      )} />
      <span className="text-xs text-slate-500">{label}:</span>
      <span className={cn(
        'text-xs font-medium',
        status === 'good' ? 'text-slate-500' :
        status === 'warning' ? 'text-warning' : 
        'text-violation'
      )}>{value}</span>
    </div>
  );
}
