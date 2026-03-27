import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Shield, ChevronLeft, Smartphone, Laptop, Camera,
  CheckCircle, AlertCircle, RefreshCw, Copy, Wifi,
  Volume2, Maximize, ArrowRight
} from 'lucide-react';
import { cn, generatePairingCode } from '@/lib/utils';
import { fetchApi } from '@/lib/api';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';
import { ThemeProvider } from '@aws-amplify/ui-react';

interface ExamLaunchProps {
  examId?: string;
}

const STEPS = [
  { id: 'prepare', label: 'Preparation', icon: Laptop },
  { id: 'pair', label: 'Mobile Pairing', icon: Smartphone },
  { id: 'verify', label: 'Verification', icon: Camera },
  { id: 'liveness', label: 'Liveness Check', icon: Shield },
  { id: 'start', label: 'Start Exam', icon: CheckCircle },
];

export function ExamLaunch({ examId = 'exam-1' }: ExamLaunchProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [isPaired, setIsPaired] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [screenPermission, setScreenPermission] = useState<boolean | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
  const [livenessPassed, setLivenessPassed] = useState<boolean>(false);
  const [livenessError, setLivenessError] = useState<string | null>(null);
  const [examEnabled, setExamEnabled] = useState(true);
  const [examDurationMins, setExamDurationMins] = useState(60);
  const [requireFullscreen, setRequireFullscreen] = useState(true);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const setupCheckInFlightRef = useRef(false);
  const allowNavigationRef = useRef(false);

  // Setup step face indicator should reflect real detection (not assume success).
  const [setupFaceCheck, setSetupFaceCheck] = useState<
    'idle' | 'checking' | 'detected' | 'not_detected' | 'unavailable'
  >('idle');

  // Generate pairing code on mount
  useEffect(() => {
    setPairingCode(generatePairingCode());
  }, []);

  useEffect(() => {
    const loadExamPolicy = async () => {
      try {
        const res = await fetchApi('/dashboard/student/exams');
        if (!res?.success || !Array.isArray(res?.data)) return;

        const currentExam = res.data.find((exam: any) => exam.id === examId);
        if (!currentExam) return;

        setExamEnabled(currentExam.enabled !== false);
        setExamDurationMins(Number(currentExam.duration) > 0 ? Number(currentExam.duration) : 60);
        setRequireFullscreen(currentExam.requireFullscreen !== false);
      } catch (err) {
        console.error('Failed to load exam policy:', err);
      }
    };

    loadExamPolicy();
  }, [examId]);

  const [reqStatus, setReqStatus] = useState({
    internet: 'checking' as 'checking' | 'passed' | 'failed' | 'pending',
    camera: 'pending' as 'checking' | 'passed' | 'failed' | 'pending',
    mic: 'pending' as 'checking' | 'passed' | 'failed' | 'pending',
    screen: 'pending' as 'checking' | 'passed' | 'failed' | 'pending'
  });

  // Simulate preparation checks
  useEffect(() => {
    if (currentStep === 0) {
      setReqStatus({ internet: 'checking', camera: 'pending', mic: 'pending', screen: 'pending' });
      const timer1 = setTimeout(() => setReqStatus(s => ({ ...s, internet: 'passed', camera: 'checking' })), 1500);
      const timer2 = setTimeout(() => setReqStatus(s => ({ ...s, camera: 'passed', mic: 'checking' })), 3000);
      const timer3 = setTimeout(() => setReqStatus(s => ({ ...s, mic: 'passed', screen: 'checking' })), 4500);
      const timer4 = setTimeout(() => setReqStatus(s => ({ ...s, screen: 'passed' })), 6000);
      return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); clearTimeout(timer4); };
    }
  }, [currentStep]);

  // Prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) {
        return;
      }
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the exam setup?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Connect backend pairing
  useEffect(() => {
    if (currentStep === 1 && !isPaired) {
      // Attempt backend pairing
      const pairDevice = async () => {
        try {
          // For local/dev we generate a pairing token without requiring SES permission.
          const pairRes = await fetchApi(`/exam/${examId}/pair`, {
            method: 'POST',
            body: JSON.stringify({ email: 'student@university.edu', sendEmail: false }),
          });
          if (pairRes?.pairingToken) {
            setPairingToken(pairRes.pairingToken);
          }
        } catch (err) {
          console.error("Pairing API error:", err);
        }
      };

      pairDevice();
    }
  }, [currentStep, isPaired, examId]);

  // Listen for mobile-paired socket event so desktop auto-detects pairing
  useEffect(() => {
    if (currentStep !== 1 || isPaired) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    let socket: any = null;
    const connectSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        socket = io(API_URL, {
          transports: ['websocket'],
          auth: { token },
        });

        socket.on('mobile-paired', () => {
          console.log('Mobile device paired via socket!');
          setIsPaired(true);
        });

        socket.on('connect_error', (err: any) => {
          console.error('Desktop pairing socket error:', err.message);
        });
      } catch (err) {
        console.error('Failed to connect pairing socket:', err);
      }
    };

    connectSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [currentStep, isPaired]);

  // Request camera permission
  useEffect(() => {
    if (currentStep === 2 && cameraPermission === null) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setCameraPermission(true);
          setMicPermission(true);
          setMediaStream(stream);
        })
        .catch(() => {
          setCameraPermission(false);
          setMicPermission(false);
        });
    }
  }, [currentStep, cameraPermission]);


  // Attach stream to video element when it mounts
  useEffect(() => {
    if (videoRef.current && mediaStream && currentStep === 2) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [videoRef.current, mediaStream, currentStep]);

  // Poll face detection in setup so status updates as user moves in/out of frame.
  useEffect(() => {
    if (currentStep !== 2) return;
    if (cameraPermission !== true) return;

    let cancelled = false;

    const checkFaceStatus = async () => {
      if (setupCheckInFlightRef.current) return;
      setupCheckInFlightRef.current = true;
      try {
        const video = videoRef.current;
        if (!video) return;

        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }

        const canvas = document.createElement('canvas');
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, width, height);

        const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

        setSetupFaceCheck(prev => (prev === 'idle' ? 'checking' : prev));

        // Send frame bytes to backend; backend uploads/analyzes (avoids browser S3 CORS).
        const analyzeRes = await fetchApi(`/exam/${examId}/analyze-setup-frame`, {
          method: 'POST',
          body: JSON.stringify({ imageBase64 })
        });

        if (cancelled) return;

        if (analyzeRes?.faceDetected === false || analyzeRes?.faceCount === 0) {
          setSetupFaceCheck('not_detected');
          return;
        }

        const violationType = analyzeRes?.violationType as string | undefined;
        if (analyzeRes?.violationDetected && violationType === 'face_not_detected') {
          setSetupFaceCheck('not_detected');
        } else {
          setSetupFaceCheck('detected');
        }
      } catch (e) {
        if (cancelled) return;
        console.error('Setup face detection failed:', e);
        setSetupFaceCheck('unavailable');
      } finally {
        setupCheckInFlightRef.current = false;
      }
    };

    checkFaceStatus();
    const interval = setInterval(checkFaceStatus, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      setupCheckInFlightRef.current = false;
    };
  }, [currentStep, cameraPermission, examId]);

  useEffect(() => {
    // Reset overlay state when leaving setup preview.
    if (currentStep !== 2) setSetupFaceCheck('idle');
  }, [currentStep]);

  const requestScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenPermission(true);
      // Stop the stream since this is only a permission check in Setup
      stream.getTracks().forEach(t => t.stop());
    } catch {
      setScreenPermission(false);
    }
  };

  // Liveness Session
  useEffect(() => {
    if (currentStep === 3 && !livenessSessionId) {
      const fetchLiveness = async () => {
        try {
          const res = await fetchApi(`/exam/${examId}/create-liveness-session`, { method: 'POST' });
          if (res.sessionId) {
            setLivenessSessionId(res.sessionId);
            setLivenessError(null);
          } else {
            alert('Failed to initialize liveness session from AWS.');
          }
        } catch (error) {
          console.error('Liveness session creation failed:', error);
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          alert(`Liveness check is unavailable. ${message}`);
        }
      };
      fetchLiveness();
    }
  }, [currentStep, livenessSessionId, examId]);

  const handleLivenessAnalysisComplete = async () => {
    try {
      const res = await fetchApi(`/exam/${examId}/get-liveness-result/${livenessSessionId}`);
      if (res.passed) {
        setLivenessPassed(true);
      } else {
        alert('Liveness check failed! You must be a real person in front of the camera.');
      }
    } catch (error) {
      console.error('Failed to get liveness result', error);
      alert('Failed to analyze liveness results from AWS.');
    }
  };

  // Countdown for exam start
  useEffect(() => {
    if (currentStep === 4 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (currentStep === 4 && countdown === 0) {
      localStorage.setItem(
        `examPolicy:${examId}`,
        JSON.stringify({ duration: examDurationMins, requireFullscreen })
      );
      allowNavigationRef.current = true;
      window.location.href = `/exam/${examId}/proctor`;
    }
  }, [currentStep, countdown, examId, examDurationMins, requireFullscreen]);

  const navigateSafely = (url: string) => {
    allowNavigationRef.current = true;
    window.location.href = url;
  };

  const handleNextStep = () => {
    // If moving from Verification (Step 2) to Liveness Check (Step 3), synchronously 
    // release the camera so FaceLivenessDetector can immediately grab it.
    if (currentStep === 2 && mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(c => c + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(c => c - 1);
    }
  };

  const copyPairingCode = () => {
    navigator.clipboard.writeText(pairingCode);
  };

  const refreshPairingCode = () => {
    setPairingCode(generatePairingCode());
    setPairingToken(null);
    setIsPaired(false);
  };

  const pairingQrValue = pairingToken
    ? `${window.location.origin}/mobile-pair?token=${pairingToken}&exam=${examId}`
    : `${window.location.origin}/mobile-pair?code=${pairingCode}&exam=${examId}`;

  return (
    <div className="min-h-screen bg-navy-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-navy-900/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigateSafely('/dashboard')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10">
                <Shield className="h-6 w-6 text-cyan" />
              </div>
              <div>
                <h1 className="font-sora text-lg font-bold text-white">SecureGuard</h1>
                <p className="text-xs text-text-secondary">Exam Setup</p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="hidden md:flex items-center gap-2">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                    isActive && 'bg-cyan/10 text-cyan',
                    isCompleted && 'text-success',
                    !isActive && !isCompleted && 'text-white/40'
                  )}>
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium hidden lg:inline">{step.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn(
                      'w-8 h-px mx-2',
                      isCompleted ? 'bg-success' : 'bg-white/10'
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <AnimatePresence mode="wait">
            {/* Step 1: Preparation */}
            {currentStep === 0 && (
              <motion.div
                key="prepare"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="font-sora text-2xl font-bold text-white">Before You Begin</h2>
                  <p className="mt-2 text-text-secondary">Make sure you meet all requirements for a secure exam session</p>
                </div>

                {!examEnabled && (
                  <div className="glass-card border border-violation/30 bg-violation/10 p-6">
                    <h4 className="font-semibold text-violation">This test is currently disabled by admin</h4>
                    <p className="mt-2 text-sm text-white/70">Please contact your instructor and return to dashboard.</p>
                    <button
                      type="button"
                      onClick={() => navigateSafely('/dashboard')}
                      className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <RequirementCard
                    icon={Wifi}
                    title="Stable Internet"
                    description="Minimum 2 Mbps upload/download speed required"
                    status={reqStatus.internet}
                  />
                  <RequirementCard
                    icon={Camera}
                    title="Working Camera"
                    description="Webcam must be functional and unobstructed"
                    status={reqStatus.camera}
                  />
                  <RequirementCard
                    icon={Volume2}
                    title="Microphone"
                    description="Required for audio monitoring during exam"
                    status={reqStatus.mic}
                  />
                  <RequirementCard
                    icon={Maximize}
                    title="Full Screen"
                    description="Exam must be taken in fullscreen mode"
                    status={reqStatus.screen}
                  />
                </div>

                <div className="glass-card p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-cyan flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-white">Important Rules</h4>
                      <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                        <li>• You must remain in front of your camera at all times</li>
                        <li>• No external materials, books, or notes allowed</li>
                        <li>• No talking or communication with others</li>
                        <li>• Mobile phone must be paired and positioned to show your workspace</li>
                        <li>• Leaving the exam tab will trigger a violation</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-white transition-colors">
                    <input 
                      type="checkbox" 
                      checked={rulesAccepted} 
                      onChange={e => setRulesAccepted(e.target.checked)} 
                      className="rounded border-cyan/30 text-cyan focus:ring-cyan bg-navy-800"
                    />
                    I understand and agree to the proctoring rules
                  </label>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={handleNextStep} 
                    disabled={!examEnabled || reqStatus.screen !== 'passed' || !rulesAccepted}
                    className={cn(
                      'btn-primary flex items-center gap-2',
                      (!examEnabled || reqStatus.screen !== 'passed' || !rulesAccepted) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Continue to Pairing
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Mobile Pairing */}
            {currentStep === 1 && (
              <motion.div
                key="pair"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="font-sora text-2xl font-bold text-white">Pair Your Mobile Device</h2>
                  <p className="mt-2 text-text-secondary">Use your phone as a secondary camera for room monitoring</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* QR Code */}
                  <div className="glass-card p-6 flex flex-col items-center">
                    <h3 className="font-medium text-white mb-4">Scan QR Code</h3>
                    <div className="relative p-4 bg-white rounded-xl">
                      <QRCodeSVG 
                        value={pairingQrValue}
                        size={200}
                        level="H"
                      />
                      {isPaired && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute inset-0 flex items-center justify-center bg-success/90 rounded-xl"
                        >
                          <CheckCircle className="h-16 w-16 text-navy-900" />
                        </motion.div>
                      )}
                    </div>
                    <p className="mt-4 text-sm text-text-secondary text-center">
                      Open mobile app and scan to pair automatically
                    </p>
                    
                    {!isPaired && (
                      <button 
                        onClick={() => setIsPaired(true)}
                        className="mt-6 px-4 py-2 bg-cyan/10 text-cyan border border-cyan/20 rounded-lg hover:bg-cyan/20 transition-colors w-full text-sm font-medium"
                      >
                        [Dev] Simulate Mobile App Scan
                      </button>
                    )}
                  </div>

                  {/* Pairing Code */}
                  <div className="space-y-4">
                    <div className="glass-card p-6">
                      <h3 className="font-medium text-white mb-4">Or Enter Pairing Code</h3>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={pairingCode}
                            readOnly
                            className="input-dark w-full text-center font-mono text-2xl tracking-widest"
                          />
                        </div>
                        <button
                          onClick={copyPairingCode}
                          className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <Copy className="h-5 w-5" />
                        </button>
                        <button
                          onClick={refreshPairingCode}
                          className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <RefreshCw className="h-5 w-5" />
                        </button>
                      </div>
                      <p className="mt-4 text-sm text-text-secondary">
                        Enter this code in the SecureGuard mobile app
                      </p>
                    </div>

                    {/* Pairing Status */}
                    <div className={cn(
                      'glass-card p-4 transition-all',
                      isPaired ? 'border-success/30 bg-success/5' : 'border-white/10'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center',
                          isPaired ? 'bg-success/20' : 'bg-white/10'
                        )}>
                          <Smartphone className={cn(
                            'h-5 w-5',
                            isPaired ? 'text-success' : 'text-white/40'
                          )} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">
                            {isPaired ? 'Device Paired Successfully' : 'Waiting for device...'}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {isPaired 
                              ? 'Mobile Device - Connected' 
                              : 'Keep this page open while pairing'}
                          </p>
                        </div>
                        {isPaired && <CheckCircle className="h-6 w-6 text-success" />}
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="rounded-xl bg-cyan/5 p-4 border border-cyan/10">
                      <h4 className="text-sm font-medium text-cyan mb-2">Positioning Guide</h4>
                      <ul className="space-y-1 text-sm text-text-secondary">
                        <li>• Place phone 3-4 feet to your side</li>
                        <li>• Angle to capture your desk and hands</li>
                        <li>• Ensure good lighting</li>
                        <li>• Keep phone plugged in for power</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button onClick={handlePrevStep} className="btn-outline">
                    Back
                  </button>
                  <button 
                    onClick={handleNextStep} 
                    disabled={!isPaired}
                    className={cn(
                      'btn-primary flex items-center gap-2',
                      !isPaired && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Verification */}
            {currentStep === 2 && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="font-sora text-2xl font-bold text-white">System Verification</h2>
                  <p className="mt-2 text-text-secondary">Confirming all monitoring systems are active</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Camera Preview */}
                  <div className="glass-card p-6">
                    <h3 className="font-medium text-white mb-4">Camera Preview</h3>
                    <div className="relative aspect-video rounded-xl bg-navy-800 overflow-hidden">
                      {cameraPermission === true ? (
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : cameraPermission === false ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <AlertCircle className="h-12 w-12 text-violation mb-2" />
                          <p className="text-sm text-text-secondary">Camera access denied</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="h-12 w-12 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                          <p className="mt-2 text-sm text-text-secondary">Requesting access...</p>
                        </div>
                      )}
                      
                      {/* Face Detection Overlay */}
                      {cameraPermission === true && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border-2 border-cyan/50 rounded-lg">
                            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan" />
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan" />
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan" />
                          </div>
                          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-navy-900/80 px-3 py-1 rounded-full">
                            <span
                              className={[
                                'h-2 w-2 rounded-full',
                                setupFaceCheck === 'checking' && 'bg-cyan animate-pulse',
                                setupFaceCheck === 'detected' && 'bg-success animate-pulse',
                                setupFaceCheck === 'not_detected' && 'bg-violation',
                                setupFaceCheck === 'unavailable' && 'bg-warning'
                              ].filter(Boolean).join(' ')}
                            />
                            <span className="text-xs text-white">
                              {setupFaceCheck === 'checking' && 'Checking face...'}
                              {setupFaceCheck === 'detected' && 'Face detected'}
                              {setupFaceCheck === 'not_detected' && 'No face detected'}
                              {setupFaceCheck === 'unavailable' && 'Face detection unavailable'}
                              {setupFaceCheck === 'idle' && 'Face detection...'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Checks */}
                  <div className="space-y-4">
                    <StatusCheckItem
                      label="Camera Access"
                      status={cameraPermission}
                      successText="Camera active"
                      errorText="Camera blocked"
                    />
                    <StatusCheckItem
                      label="Microphone Access"
                      status={micPermission}
                      successText="Microphone active"
                      errorText="Microphone blocked"
                    />
                    <StatusCheckItem
                      label="Screen Recording"
                      status={screenPermission}
                      successText="Ready to record"
                      errorText="Permission denied"
                      actionText="Allow Screen"
                      onCheck={requestScreenShare}
                    />
                    <StatusCheckItem
                      label="Browser Lockdown"
                      status={true}
                      successText="Lockdown ready"
                    />
                    <StatusCheckItem
                      label="Mobile Camera"
                      status={isPaired}
                      successText="Mobile device connected"
                      errorText="Not connected"
                    />
                  </div>
                </div>

                <div className="flex justify-between">
                  <button onClick={handlePrevStep} className="btn-outline">
                    Back
                  </button>
                  <button 
                    onClick={handleNextStep}
                    disabled={cameraPermission !== true}
                    className={cn(
                      'btn-primary flex items-center gap-2',
                      cameraPermission !== true && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Proceed to Liveness Check
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Liveness Check */}
            {currentStep === 3 && (
              <motion.div
                key="liveness"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="font-sora text-2xl font-bold text-white">Face Liveness Check</h2>
                  <p className="mt-2 text-text-secondary">Please position your face in the oval to prove you're a real person.</p>
                </div>

                <div className="glass-card p-6 flex justify-center items-center bg-white">
                  {livenessSessionId && !livenessPassed ? (
                    <ThemeProvider>
                      <FaceLivenessDetector
                        sessionId={livenessSessionId}
                        region={import.meta.env.VITE_AWS_REGION || "ap-south-1"}
                        onAnalysisComplete={handleLivenessAnalysisComplete}
                        onError={(e) => {
                          const msg = (e as any)?.message || 'Face liveness stream failed';
                          console.error('Liveness detector error:', e);
                          setLivenessError(msg);
                        }}
                        disableStartScreen={true}
                      />
                    </ThemeProvider>
                  ) : livenessPassed ? (
                     <div className="flex flex-col items-center justify-center p-8">
                      <CheckCircle className="h-16 w-16 text-success mb-4" />
                      <p className="text-xl font-bold text-navy-900">Verification Passed!</p>
                     </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8">
                      <div className="h-12 w-12 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                      <p className="mt-4 text-navy-900">Loading liveness session...</p>
                    </div>
                  )}

                  {!livenessPassed && livenessError && (
                    <div className="mt-4 rounded-lg border border-violation/30 bg-violation/10 p-3 text-navy-900 w-full max-w-xl">
                      <p className="text-sm font-medium">Liveness error: {livenessError}</p>
                      <p className="text-xs mt-1">If this is local testing, use the dev bypass below.</p>
                      {(import.meta.env.DEV || import.meta.env.VITE_ALLOW_LIVENESS_BYPASS === 'true') && (
                        <button
                          onClick={() => setLivenessPassed(true)}
                          className="mt-2 px-3 py-1.5 rounded bg-cyan text-navy-900 text-sm font-semibold"
                        >
                          Dev Bypass Liveness
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <button onClick={handlePrevStep} className="btn-outline">
                    Back
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={!livenessPassed}
                    className={cn(
                      'btn-primary flex items-center gap-2',
                      !livenessPassed && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Proceed to Exam
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Start Exam */}
            {currentStep === 4 && (
              <motion.div
                key="start"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8"
              >
                <div className="glass-card p-8 max-w-md mx-auto">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="mx-auto h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mb-6"
                  >
                    <CheckCircle className="h-10 w-10 text-success" />
                  </motion.div>
                  
                  <h2 className="font-sora text-2xl font-bold text-white">All Systems Ready!</h2>
                  <p className="mt-2 text-text-secondary">
                    Your exam environment is fully secured and monitored
                  </p>

                  <div className="mt-8">
                    <p className="text-sm text-text-secondary mb-2">Exam starts in</p>
                    <div className="font-sora text-6xl font-bold text-cyan">
                      {countdown}
                    </div>
                  </div>

                  <div className="mt-8 space-y-2 text-sm text-text-secondary">
                    <p>Machine Learning Basics</p>
                    <p>60 minutes • 30 questions</p>
                  </div>
                </div>

                <p className="text-sm text-text-secondary">
                  Do not close this window or refresh the page
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

interface RequirementCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  status: 'checking' | 'passed' | 'failed' | 'pending';
}

function RequirementCard({ icon: Icon, title, description, status }: RequirementCardProps) {
  return (
    <div className="glass-card p-4 flex items-start gap-4">
      <div className={cn(
        'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
        status === 'passed' ? 'bg-success/10' : 
        status === 'failed' ? 'bg-violation/10' : 
        status === 'checking' ? 'bg-cyan/10' : 'bg-white/5'
      )}>
        <Icon className={cn(
          'h-5 w-5',
          status === 'passed' ? 'text-success' : 
          status === 'failed' ? 'text-violation' : 
          status === 'checking' ? 'text-cyan' : 'text-white/40'
        )} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-white">{title}</h4>
          {status === 'checking' && (
            <div className="h-4 w-4 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
          )}
          {status === 'passed' && <CheckCircle className="h-4 w-4 text-success" />}
        </div>
        <p className="text-sm text-text-secondary mt-1">{description}</p>
      </div>
    </div>
  );
}

interface StatusCheckItemProps {
  label: string;
  status: boolean | null;
  successText: string;
  errorText?: string;
  actionText?: string;
  onCheck?: () => void;
}

function StatusCheckItem({ label, status, successText, errorText, actionText, onCheck }: StatusCheckItemProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-3">
        {status === true ? (
          <CheckCircle className="h-5 w-5 text-success" />
        ) : status === false ? (
          <AlertCircle className="h-5 w-5 text-violation" />
        ) : actionText ? (
          <Laptop className="h-5 w-5 text-warning" />
        ) : (
          <div className="h-5 w-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
        )}
        <span className="text-white">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn(
          'text-sm',
          status === true ? 'text-success' : 
          status === false ? 'text-violation' : 
          'text-text-secondary'
        )}>
          {status === true ? successText : status === false ? errorText : (actionText ? 'Permission Required' : 'Checking...')}
        </span>
        {status === false && onCheck && (
          <button 
            onClick={onCheck}
            className="text-xs text-cyan hover:text-cyan-light"
          >
            Retry
          </button>
        )}
        {status === null && actionText && onCheck && (
          <button 
            onClick={onCheck}
            className="text-xs px-2 py-1 rounded bg-cyan/20 text-cyan hover:bg-cyan/30"
          >
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
}
