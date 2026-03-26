import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Clock, AlertTriangle, CheckCircle, X,
  Monitor, Smartphone, Wifi, 
  Maximize2, Minimize2, MessageSquare, Flag,
  Eye, Volume2, Activity, User
} from 'lucide-react';
import { cn, getViolationDescription } from '@/lib/utils';
import { useSimulatedTelemetry, useSimulatedViolations } from '@/hooks/useSocket';
import { fetchApi } from '@/lib/api';

interface LiveProctoringProps {
  examId?: string;
}

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
}

export function LiveProctoring({ examId = 'exam-1' }: LiveProctoringProps) {
  const [sessionTime, setSessionTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMobilePip, setShowMobilePip] = useState(true);
  const [showScreenPip, setShowScreenPip] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Simulated real-time data
  const telemetry = useSimulatedTelemetry(examId);
  const violations = useSimulatedViolations(examId);

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Camera initialization
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(console.error);
  }, []);

  // Continuous Monitoring (Phone/Person)
  useEffect(() => {
    const captureAndAnalyze = async () => {
      if (!videoRef.current) return;

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        try {
          // 1. Get presigned URL
          const presignedRes = await fetchApi(`/exam/${examId}/presigned-url`, {
            method: 'POST',
            body: JSON.stringify({ filename: 'frame.jpg' })
          });

          if (presignedRes.success && presignedRes.url) {
            // 2. Upload to S3
            await fetch(presignedRes.url, {
              method: 'PUT',
              body: blob,
              headers: {
                'Content-Type': 'image/jpeg'
              }
            });

            // 3. Request Analysis
            const analyzeRes = await fetchApi(`/exam/${examId}/analyze-frame`, {
              method: 'POST',
              body: JSON.stringify({ s3Key: presignedRes.s3Key })
            });

            if (analyzeRes.violationDetected) {
              addToast({
                id: Date.now().toString(),
                type: 'error',
                title: 'Security Violation Detected',
                message: analyzeRes.violationType
              });
            }
          }
        } catch (err) {
          console.error('Frame analysis failed:', err);
        }
      }, 'image/jpeg', 0.8);
    };

    const interval = setInterval(captureAndAnalyze, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [examId]);

  // Handle violations - show toasts
  useEffect(() => {
    if (violations.length > 0) {
      const latest = violations[0];
      addToast({
        id: latest.id,
        type: latest.severity === 'high' ? 'error' : 'warning',
        title: 'Violation Detected',
        message: getViolationDescription(latest.type),
      });
    }
  }, [violations]);

  // Self-correct toasts
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.9) {
        addToast({
          id: `auto-${Date.now()}`,
          type: 'success',
          title: 'System Self-Corrected',
          message: 'All monitoring parameters normalized',
        });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const addToast = (toast: Toast) => {
    setToasts(prev => [toast, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const toggleFullscreen = () => {
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

  return (
    <div className="min-h-screen bg-navy-900 overflow-hidden">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-navy-900/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan/10">
              <Shield className="h-5 w-5 text-cyan" />
            </div>
            <div>
              <h1 className="font-sora text-sm font-semibold text-white">Machine Learning Basics</h1>
              <p className="text-xs text-text-secondary">Exam ID: {examId}</p>
            </div>
          </div>

          {/* Center Timer */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <Clock className="h-4 w-4 text-cyan" />
              <span className="font-mono text-lg font-semibold text-white">
                {formatSessionTime(sessionTime)}
              </span>
              <span className="text-xs text-text-secondary">/ 60:00</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                chatOpen ? 'bg-cyan/20 text-cyan' : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violation/20 text-violation hover:bg-violation/30 transition-colors">
              <Flag className="h-4 w-4" />
              <span className="text-sm font-medium">Report Issue</span>
            </button>
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-navy-800/50 border-t border-white/5 overflow-x-auto scrollbar-hide">
          <TelemetryBadge 
            icon={Eye} 
            label="Gaze" 
            value={telemetry.gazeDirection === 'center' ? 'Center' : 'Away'}
            status={telemetry.gazeDirection === 'center' ? 'good' : 'warning'}
          />
          <TelemetryBadge 
            icon={User} 
            label="Face" 
            value={`${Math.round(telemetry.faceConfidence)}%`}
            status={telemetry.faceDetected ? 'good' : 'error'}
          />
          <TelemetryBadge 
            icon={Volume2} 
            label="Audio" 
            value={`${Math.round(telemetry.ambientNoise)}dB`}
            status={telemetry.ambientNoise < 40 ? 'good' : 'warning'}
          />
          <TelemetryBadge 
            icon={Monitor} 
            label="Screen" 
            value={telemetry.browserFocused ? 'Active' : 'Away'}
            status={telemetry.browserFocused ? 'good' : 'warning'}
          />
          <TelemetryBadge 
            icon={Smartphone} 
            label="Mobile" 
            value="Connected"
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

      {/* Main Content Area */}
      <main className="pt-32 pb-4 px-4 h-screen">
        <div className="relative h-full">
          {/* Primary Webcam Feed */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden bg-navy-800">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Face Detection Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {telemetry.faceDetected ? (
                <>
                  {/* Bounding Box */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <div className="relative w-40 h-52">
                      {/* Corner markers */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan" />
                      
                      {/* Center dot */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-cyan rounded-full" />
                      
                      {/* Keypoints */}
                      {['top-4 left-8', 'top-4 right-8', 'top-12 left-4', 'top-12 right-4', 
                        'bottom-8 left-12', 'bottom-8 right-12', 'bottom-16 left-1/2'].map((pos, i) => (
                        <div 
                          key={i}
                          className={cn(
                            'absolute w-1.5 h-1.5 rounded-full bg-cyan/60 animate-pulse',
                            pos
                          )}
                          style={{ animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                  </motion.div>
                  
                  {/* Labels */}
                  <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -mt-32">
                    <span className="px-2 py-1 rounded bg-cyan/20 text-cyan text-xs font-mono">
                      face: {Math.round(telemetry.faceConfidence)}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="glass-card p-6 text-center">
                    <AlertTriangle className="h-12 w-12 text-violation mx-auto mb-2" />
                    <p className="text-white font-medium">Face Not Detected</p>
                    <p className="text-sm text-text-secondary mt-1">Please position yourself in front of the camera</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recording Indicator */}
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-violation/20 border border-violation/30">
              <span className="h-2 w-2 rounded-full bg-violation animate-pulse" />
              <span className="text-xs font-medium text-violation">REC</span>
            </div>
          </div>

          {/* Mobile Camera PiP */}
          <AnimatePresence>
            {showMobilePip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 100 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 100 }}
                className="absolute bottom-4 right-4 w-48 md:w-64 aspect-[3/4] rounded-xl overflow-hidden bg-navy-800 border border-white/10 shadow-2xl"
              >
                <div className="relative w-full h-full">
                  {/* Simulated mobile camera view */}
                  <div className="absolute inset-0 bg-gradient-to-br from-navy-700 to-navy-800">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Smartphone className="h-8 w-8 text-white/20 mx-auto mb-2" />
                        <p className="text-xs text-white/40">Mobile Camera</p>
                      </div>
                    </div>
                    
                    {/* Simulated desk view overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-navy-900/80 to-transparent" />
                  </div>
                  
                  {/* Mobile camera label */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-navy-900/80">
                    <Smartphone className="h-3 w-3 text-cyan" />
                    <span className="text-xs text-white/80">iPhone 13 Pro</span>
                  </div>
                  
                  {/* Gyro indicator */}
                  <div className="absolute top-2 right-2 px-2 py-1 rounded bg-success/20 border border-success/30">
                    <span className="text-xs text-success">Gyro Active</span>
                  </div>
                  
                  {/* Close button */}
                  <button
                    onClick={() => setShowMobilePip(false)}
                    className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-navy-900/80 flex items-center justify-center text-white/60 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Screen Share PiP */}
          <AnimatePresence>
            {showScreenPip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 100 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 100 }}
                className="absolute bottom-4 left-4 w-64 md:w-80 aspect-video rounded-xl overflow-hidden bg-navy-800 border border-white/10 shadow-2xl"
              >
                <div className="relative w-full h-full">
                  {/* Simulated screen view */}
                  <div className="absolute inset-0 bg-navy-700">
                    <div className="p-3 space-y-2">
                      <div className="h-2 w-3/4 bg-white/10 rounded" />
                      <div className="h-2 w-1/2 bg-white/10 rounded" />
                      <div className="h-20 bg-white/5 rounded mt-4" />
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="h-8 bg-cyan/20 rounded" />
                        <div className="h-8 bg-white/10 rounded" />
                        <div className="h-8 bg-white/10 rounded" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Screen label */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-navy-900/80">
                    <Monitor className="h-3 w-3 text-cyan" />
                    <span className="text-xs text-white/80">Screen Share</span>
                  </div>
                  
                  {/* Close button */}
                  <button
                    onClick={() => setShowScreenPip(false)}
                    className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-navy-900/80 flex items-center justify-center text-white/60 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed right-0 top-24 bottom-0 w-80 bg-navy-900/95 backdrop-blur-xl border-l border-white/10 z-30"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="font-medium text-white">Proctor Chat</h3>
                <button 
                  onClick={() => setChatOpen(false)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-cyan/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-4 w-4 text-cyan" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-text-secondary mb-1">Proctor</p>
                    <p className="text-sm text-white bg-white/5 p-2 rounded-lg">
                      Welcome to your exam! I'm here to monitor and assist if needed. Good luck!
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="input-dark flex-1 text-sm"
                  />
                  <button className="px-3 py-2 rounded-lg bg-cyan text-navy-900 font-medium hover:bg-cyan-light transition-colors">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              {toast.type === 'info' && <Activity className="h-5 w-5 flex-shrink-0" />}
              
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

      {/* Violation Alert Overlay */}
      <AnimatePresence>
        {violations.length > 0 && violations[0].severity === 'high' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-violation/20 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glass-card p-6 max-w-md mx-4 border-violation/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-violation/20 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="h-6 w-6 text-violation" />
                </div>
                <div>
                  <h3 className="font-sora text-lg font-bold text-violation">Violation Alert</h3>
                  <p className="text-sm text-text-secondary">Please correct your behavior</p>
                </div>
              </div>
              
              <p className="text-white mb-4">{getViolationDescription(violations[0].type)}</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {}}
                  className="flex-1 btn-outline border-violation text-violation hover:bg-violation/10"
                >
                  I Understand
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
