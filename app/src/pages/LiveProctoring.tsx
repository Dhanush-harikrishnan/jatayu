import { useState, useEffect, useRef } from 'react';
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
  evidenceKey: string;
}

const QUESTIONS = [
  { id: 1, text: "What is the primary function of a reverse proxy?", options: ["Load balancing & security", "Database indexing", "Compiling backend code", "Direct network routing"], correct: 0 },
  { id: 2, text: "Which HTTP method is idempotent according to REST principles?", options: ["POST", "PATCH", "PUT", "CONNECT"], correct: 2 },
  { id: 3, text: "What is the worst-case time complexity of binary search?", options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"], correct: 2 },
  { id: 4, text: "Which AWS service is optimized for NoSQL key-value high-throughput storage?", options: ["Amazon RDS", "Amazon DynamoDB", "Amazon S3", "Amazon Redshift"], correct: 1 },
  { id: 5, text: "What does CORS stand for in web security context?", options: ["Cross-Origin Resource Sharing", "Centralized Object Routing System", "Computer Operated Relay Server", "Core Operations Regression Suite"], correct: 0 }
];

export function LiveProctoring({ examId = 'exam-1' }: LiveProctoringProps) {
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const noFaceStrikeRef = useRef(0);
  const allowNavigationRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

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
    });

    socket.on('connect_error', (err) => {
      console.error('LiveProctoring socket error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const addToast = (toast: Toast) => {
    setToasts(prev => [toast, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 5000);
  };

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
  }, [requireFullscreen]);

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
  }, [examId, realViolations]);

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

  const handleEndExam = async () => {
    if (!window.confirm("Are you sure you want to finish and submit the exam? You cannot change your answers after submission.")) return;
    
    setIsSubmitting(true);

    // Signal the backend (and all room members, e.g. mobile camera) that
    // the exam has explicitly ended.
    if (socketRef.current?.connected) {
      socketRef.current.emit('end-exam');
    }

    const sessionId = localStorage.getItem('sessionId');
    const email = 'student@university.edu'; // Placeholder

    try {
      if (sessionId) {
        const violationsForPdf = realViolations.map(v => ({
          type: v.type,
          timestamp: v.timestamp,
          evidence: v.evidenceKey,
        }));
        await fetchApi(`/exam/${examId}/report/${sessionId}`, {
          method: 'POST',
          body: JSON.stringify({ email, violations: violationsForPdf })
        });
      }

      addToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Exam Submitted',
        message: 'Your exam report has been generated and sent to your email.'
      });

      setTimeout(() => {
        allowNavigationRef.current = true;
        window.location.href = '/dashboard';
      }, 2000);

    } catch (error) {
      console.error('Failed to end exam and send report:', error);
      setTimeout(() => {
        allowNavigationRef.current = true;
        window.location.href = '/dashboard';
      }, 1000);
    }
  };

  const currentQ = QUESTIONS[currentQuestionIdx];

  return (
    <div className="min-h-screen bg-navy-900 overflow-hidden flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-navy-900/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan/10">
              <Shield className="h-5 w-5 text-cyan" />
            </div>
            <div>
              <h1 className="font-sora text-sm font-semibold text-white">Introduction to Computer Science</h1>
              <p className="text-xs text-text-secondary">Exam ID: {examId}</p>
            </div>
          </div>

          {/* Center Timer */}
          <div className="flex items-center gap-4">
            <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border", sessionTime <= 300 ? "bg-violation/10 border-violation/30" : "bg-white/5 border-white/10")}>
              <Clock className={cn("h-4 w-4", sessionTime <= 300 ? "text-violation animate-pulse" : "text-cyan")} />
              <span className={cn("font-mono text-lg font-semibold", sessionTime <= 300 ? "text-violation animate-pulse" : "text-white")}>
                {formatSessionTime(sessionTime)}
              </span>
              <span className="text-xs text-text-secondary"> remaining</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              disabled={requireFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={handleEndExam}
              disabled={isSubmitting}
              className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors shadow-[0_0_15px_rgba(46,204,113,0.3)]",
                  isSubmitting ? "bg-success/50 text-navy-900/50" : "bg-success text-navy-900 hover:bg-success-light"
              )}
            >
              <CheckCircle className="h-4 w-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Finish Exam'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-navy-800/50 border-t border-white/5 overflow-x-auto scrollbar-hide">
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
        <div className="flex-1 glass-card p-8 flex flex-col relative z-10">
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-sora font-semibold text-white">Question {currentQuestionIdx + 1} of {QUESTIONS.length}</h2>
                <div className="flex space-x-1">
                    {QUESTIONS.map((_, idx) => (
                        <div key={idx} className={cn(
                            "w-8 h-2 rounded-full transition-colors",
                            idx === currentQuestionIdx ? "bg-cyan" : 
                            answers[idx] !== undefined ? "bg-success/60" : "bg-white/10"
                        )} />
                    ))}
                </div>
            </div>

            <div className="flex-1">
                <p className="text-xl text-white/90 leading-relaxed mb-8">{currentQ.text}</p>

                <div className="space-y-4">
                    {currentQ.options.map((opt, idx) => {
                        const isSelected = answers[currentQuestionIdx] === idx;
                        return (
                        <button
                            key={idx}
                            onClick={() => setAnswers({...answers, [currentQuestionIdx]: idx})}
                            className={cn(
                                "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group",
                                isSelected ? "bg-cyan/10 border-cyan shadow-[0_0_15px_rgba(0,240,255,0.15)]" : "bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10"
                            )}
                        >
                            <span className={cn("text-lg", isSelected ? "text-cyan font-medium" : "text-white/80")}>{opt}</span>
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                isSelected ? "border-cyan" : "border-white/30 group-hover:border-white/50"
                            )}>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-cyan" />}
                            </div>
                        </button>
                    )})}
                </div>
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
                <button
                    onClick={() => setCurrentQuestionIdx(i => Math.max(0, i - 1))}
                    disabled={currentQuestionIdx === 0}
                    className="px-6 py-2.5 rounded-lg btn-outline disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                {currentQuestionIdx < QUESTIONS.length - 1 ? (
                    <button
                        onClick={() => setCurrentQuestionIdx(i => i + 1)}
                        className="px-6 py-2.5 rounded-lg btn-primary"
                    >
                        Next Question
                    </button>
                ) : (
                    <button
                        onClick={handleEndExam}
                        className="px-6 py-2.5 rounded-lg bg-success text-navy-900 font-bold hover:bg-success-light shadow-[0_0_15px_rgba(46,204,113,0.3)] transition-colors"
                    >
                        Review & Submit
                    </button>
                )}
            </div>
        </div>

        {/* Right Side - Picture-in-Picture feeds */}
        <div className="w-72 flex flex-col gap-4 relative z-10 flex-shrink-0">
          {/* Main Web Camera PiP */}
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-navy-800 border-2 border-cyan/30 shadow-[0_0_20px_rgba(0,240,255,0.1)] relative group">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Top right label */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-navy-900/80 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-violation animate-pulse" />
                <span className="text-[10px] text-white/80 font-medium tracking-wider uppercase">Live Feed</span>
            </div>
            
            {/* Outline box mimicking face detection */}
            {telemetryState.faceDetected && (
              <div className="absolute inset-x-8 inset-y-6 border border-cyan/40 rounded-lg shadow-[inset_0_0_20px_rgba(0,240,255,0.1)] pointer-events-none" />
            )}
          </div>
          
          {/* Simulated Mobile Feed PiP */}
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-navy-800 border border-white/10 relative">
             <div className="absolute inset-0 bg-gradient-to-br from-navy-700 to-navy-800 flex items-center justify-center">
                <div className="text-center grayscale opacity-50">
                    <Smartphone className="h-8 w-8 text-white/40 mx-auto mb-2" />
                    <p className="text-xs text-white/60">Secondary Camera Active</p>
                </div>
             </div>
             <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-navy-900/80">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-white/80 uppercase">iPhone 13</span>
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
                toast.type === 'error' && 'bg-violation/90 text-white',
                toast.type === 'warning' && 'bg-warning/90 text-navy-900',
                toast.type === 'success' && 'bg-success/90 text-navy-900',
                toast.type === 'info' && 'bg-cyan/90 text-navy-900'
              )}
            >
              {toast.type === 'error' && <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
              {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
              {toast.type === 'success' && <CheckCircle className="h-5 w-5 flex-shrink-0" />}
              {toast.type === 'info' && <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
              
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
                <X className="h-4 w-4" />
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
            className="fixed inset-0 z-[100] bg-navy-900/80 backdrop-blur-md flex items-center justify-center pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-navy-800 p-8 rounded-2xl max-w-lg w-full mx-4 border border-violation shadow-[0_0_50px_rgba(255,71,87,0.3)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-violation" />
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full bg-violation/10 flex items-center justify-center animate-pulse mb-6">
                  <AlertTriangle className="h-10 w-10 text-violation" />
                </div>
                
                <h3 className="font-sora text-3xl font-bold text-white mb-2">Automated Alert</h3>
                <p className="text-xl text-violation font-medium mb-6">
                    {getViolationDescription(realViolations[0].type)}
                </p>
                
                <div className="bg-white/5 p-4 rounded-xl mb-8 w-full">
                    <p className="text-white/80 text-sm">
                        This incident has been logged and recorded by the proctoring system. Continued violations may result in immediate termination of the exam.
                    </p>
                </div>
              
                <button 
                  onClick={clearViolations}
                  className="w-full py-4 rounded-xl bg-violation text-white font-bold text-lg hover:bg-violation/90 transition-colors shadow-lg shadow-violation/20"
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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 flex-shrink-0">
      <Icon className={cn(
        'h-3.5 w-3.5',
        status === 'good' ? 'text-success' : 
        status === 'warning' ? 'text-warning' : 
        'text-violation'
      )} />
      <span className="text-xs text-white/60">{label}:</span>
      <span className={cn(
        'text-xs font-medium',
        status === 'good' ? 'text-success' : 
        status === 'warning' ? 'text-warning' : 
        'text-violation'
      )}>{value}</span>
    </div>
  );
}
