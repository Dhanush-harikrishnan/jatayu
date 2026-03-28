import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, RefreshCw, Wifi, Signal, Shield,
  Move, AlertTriangle, Smartphone, CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { io as socketIO, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SNAPSHOT_INTERVAL_MS = 5000; // Send a frame every 5 seconds

interface MobileCameraProps {
  pairingCode?: string;
  pairingToken?: string;
}

type ConnectionState = 'idle' | 'connecting' | 'positioning' | 'waiting' | 'capturing' | 'error' | 'ended';

export function MobileCamera({ pairingCode, pairingToken }: MobileCameraProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  const [gyroData, setGyroData] = useState({ x: 0, y: 0, z: 0 });
  const [movementAlert, setMovementAlert] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const connectedAtRef = useRef<number>(0);
  const examStartedByLaptopRef = useRef<boolean>(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEverything();
    };
  }, []);

  // Battery API
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Gyroscope (real device orientation)
  useEffect(() => {
    if (!['positioning', 'waiting', 'capturing'].includes(connectionState)) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const x = e.beta ? e.beta / 180 : 0;
      const y = e.gamma ? e.gamma / 90 : 0;
      const z = e.alpha ? e.alpha / 360 : 0;
      setGyroData({ x, y, z });

      const magnitude = Math.sqrt(x ** 2 + y ** 2);
      if (magnitude > 0.8) {
        setMovementAlert(true);
        setTimeout(() => setMovementAlert(false), 3000);
        // Send gyro deviation to backend
        socketRef.current?.emit('gyro_deviation', {
          deviation: magnitude,
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [connectionState]);

  // Bind the camera stream to the video element whenever it is safely mounted in the DOM
  useEffect(() => {
    if (['positioning', 'waiting', 'capturing'].includes(connectionState) && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    }
  }, [connectionState]);

  const stopEverything = useCallback(() => {
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const requestCameraStream = async (targetFacingMode: 'environment' | 'user') => {
    const candidates: MediaStreamConstraints[] = [
      { video: { facingMode: { exact: targetFacingMode }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { facingMode: targetFacingMode }, audio: false },
      { video: true, audio: false },
    ];
    let lastError: unknown;
    for (const constraints of candidates) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  };

  const startCamera = async () => {
    try {
      const stream = await requestCameraStream(facingMode);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setErrorMessage('Camera access denied. Please allow camera permissions.');
    }
  };

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  const startSnapshotLoop = useCallback(() => {
    if (snapshotIntervalRef.current) return;

    snapshotIntervalRef.current = setInterval(() => {
      const frame = captureFrame();
      if (frame && socketRef.current?.connected) {
        socketRef.current.emit('frame', {
          imageBase64: frame,
          timestamp: Date.now(),
        });
        setSnapshotCount(prev => prev + 1);
      }
    }, SNAPSHOT_INTERVAL_MS);
  }, [captureFrame]);

  // Handle the automatic snapshot loop only when natively in capturing mode
  useEffect(() => {
    if (connectionState === 'capturing') {
      startSnapshotLoop();
    } else {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
        snapshotIntervalRef.current = null;
      }
    }
  }, [connectionState, startSnapshotLoop]);

  const handleConnect = async () => {
    setConnectionState('connecting');
    setErrorMessage(null);

    // Step 1: Start camera first
    try {
      await startCamera();
    } catch {
      setConnectionState('error');
      setErrorMessage('Failed to access camera.');
      return;
    }

    // Step 2: Get auth token for socket connection
    // The pairingToken from the QR URL is a JWT with role='secondary_camera'
    const token = pairingToken || localStorage.getItem('mobileToken');
    
    if (!token && pairingCode) {
      // If we only have a pairing code (not a token), we need to get one from the backend
      // For now, store the code and connect - the backend will handle code-based auth
      setErrorMessage('Pairing via code requires the mobile app. Please scan the QR code for full token-based pairing.');
      setConnectionState('error');
      return;
    }

    if (!token) {
      setErrorMessage('No pairing token found. Please scan the QR code again from the exam setup page.');
      setConnectionState('error');
      return;
    }

    // Step 3: Connect to socket
    try {
      const socket = socketIO(API_URL, {
        transports: ['websocket'],
        auth: { token },
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Mobile socket connected:', socket.id);
        setConnectionState('positioning');
        connectedAtRef.current = Date.now();
        // Notify the desktop that mobile is paired
        socket.emit('mobile-paired', { timestamp: Date.now() });
      });

      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setConnectionState('error');
        setErrorMessage(`Connection failed: ${err.message}`);
      });

      socket.on('exam-started', () => {
        console.log('Laptop formally started exam!');
        examStartedByLaptopRef.current = true;
        setConnectionState(prev => prev === 'waiting' ? 'capturing' : prev);
      });

      socket.on('exam-ended', () => {
        console.log('Exam ended signal received');
        // Only honor exam-ended if we've been connected long enough and
        // captured at least one frame — avoids race conditions during
        // initial connection / primary page navigation.
        const connectedLongEnough = connectedAtRef.current > 0 &&
          (Date.now() - connectedAtRef.current) > 5000;
        if (connectedLongEnough) {
          setConnectionState('ended');
          stopEverything();
        } else {
          console.warn('Ignoring premature exam-ended signal (connected too recently)');
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        if (connectionState !== 'ended') {
          // If not intentionally ended, try to show reconnecting
          if (reason === 'io server disconnect') {
            setConnectionState('ended');
            stopEverything();
          }
        }
      });
    } catch (err: any) {
      console.error('Socket setup failed:', err);
      setConnectionState('error');
      setErrorMessage(err?.message || 'Failed to connect');
    }
  };

  const switchCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);
    try {
      const stream = await requestCameraStream(newFacingMode);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera switch failed:', err);
    }
  };

  // === IDLE: Show Connect Button ===
  if (connectionState === 'idle') {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-cyan/10 mx-auto mb-6">
            <Shield strokeWidth={1} className="h-10 w-10 text-cyan" />
          </div>
          <h1 className="font-sora text-2xl font-bold text-white mb-2">SecureGuard Pro</h1>
          <p className="text-text-secondary mb-2">Secondary Camera</p>
          
          {pairingCode && (
            <div className="mt-4 mb-6 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-text-secondary mb-1">Pairing Code</p>
              <p className="font-mono text-2xl tracking-widest text-cyan">{pairingCode}</p>
            </div>
          )}

          <p className="text-sm text-text-secondary mb-8">
            Tap the button below to connect your phone as a secondary camera for exam monitoring.
            Place your phone 3-4 feet to your side, angled to capture your desk.
          </p>

          <button
            onClick={handleConnect}
            className="w-full py-4 rounded-xl bg-cyan text-navy-900 font-semibold text-lg hover:bg-cyan/90 transition-colors flex items-center justify-center gap-3"
          >
            <Camera strokeWidth={1} className="h-6 w-6" />
            Connect Camera
          </button>

          <div className="mt-6 space-y-2 text-left">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <CheckCircle strokeWidth={1} className="h-4 w-4 text-cyan/60" />
              <span>Camera will only be used during the exam</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <CheckCircle strokeWidth={1} className="h-4 w-4 text-cyan/60" />
              <span>Keep your phone plugged in for power</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <CheckCircle strokeWidth={1} className="h-4 w-4 text-cyan/60" />
              <span>Ensure good lighting in the room</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === CONNECTING ===
  if (connectionState === 'connecting') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-16 w-16 border-2 border-cyan border-t-transparent rounded-full"
        />
        <p className="mt-6 text-white font-medium text-lg">Connecting...</p>
        <p className="text-sm text-white/60 mt-2">Starting camera and connecting to exam session</p>
      </div>
    );
  }

  // === ERROR ===
  if (connectionState === 'error') {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violation/20 mx-auto mb-4">
            <AlertTriangle strokeWidth={1} className="h-8 w-8 text-violation" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
          <p className="text-sm text-text-secondary mb-6">{errorMessage || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => { setConnectionState('idle'); setErrorMessage(null); }}
            className="w-full py-3 rounded-xl bg-cyan text-navy-900 font-semibold hover:bg-cyan/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // === ENDED ===
  if (connectionState === 'ended') {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20 mx-auto mb-4">
            <CheckCircle strokeWidth={1} className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Exam Complete</h2>
          <p className="text-sm text-text-secondary mb-2">The exam session has ended.</p>
          <p className="text-sm text-text-secondary">
            {snapshotCount} frames captured during the session.
          </p>
          <p className="text-sm text-text-secondary mt-4">You can close this tab now.</p>
        </div>
      </div>
    );
  }
  // === POSITIONING: Show instructions to place phone ===
  if (connectionState === 'positioning') {
    return (
      <div className="min-h-screen bg-black overflow-hidden flex flex-col relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-black/40" />
        
        <div className="relative z-10 flex flex-col items-center justify-center p-6 min-h-screen pt-24 pb-20">
          <div className="w-full max-w-sm rounded-3xl bg-navy-900/90 backdrop-blur-md border border-white/10 p-6 flex flex-col text-center shadow-2xl">
            <Smartphone strokeWidth={1} className="h-12 w-12 text-cyan mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Position Your Camera</h2>
            <div className="text-left text-sm text-text-secondary space-y-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-cyan shrink-0 mt-0.5" />
                <span>Place your phone 3-4 feet to your side.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-cyan shrink-0 mt-0.5" />
                <span>Ensure your <strong>laptop screen</strong> and <strong>hands</strong> are visible in the frame.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-cyan shrink-0 mt-0.5" />
                <span>Keep the phone plugged into power.</span>
              </div>
            </div>
            
            <button
              onClick={() => {
                if (examStartedByLaptopRef.current) {
                  setConnectionState('capturing');
                } else {
                  setConnectionState('waiting');
                }
              }}
              className="w-full py-4 rounded-xl bg-cyan text-navy-900 font-semibold text-lg hover:bg-cyan/90 transition-colors shadow-[0_0_20px_rgba(34,211,238,0.3)]"
            >
              Ready, camera is positioned
            </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute top-8 right-6 z-20">
          <button
            onClick={switchCamera}
            className="h-12 w-12 rounded-full bg-black/60 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <RefreshCw strokeWidth={1} className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // === WAITING: Waiting for laptop to start exam ===
  if (connectionState === 'waiting') {
    return (
      <div className="min-h-screen bg-black overflow-hidden flex flex-col relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm"
        />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex h-20 w-20 bg-cyan/10 border border-cyan/20 items-center justify-center rounded-2xl mb-8 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
          >
             <CheckCircle strokeWidth={1} className="h-10 w-10 text-cyan" />
          </motion.div>
          
          <h2 className="text-2xl font-bold text-white mb-3 text-center">Camera Ready!</h2>
          <div className="max-w-xs text-center">
            <p className="text-text-secondary text-sm mb-4 leading-relaxed">
              Please continue setting up on your laptop.
            </p>
            <p className="text-white/40 text-xs">
              This camera will automatically begin capturing when you click "Start Exam" on your laptop.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // === CAPTURING: Live Camera View ===
  return (
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <Signal strokeWidth={1} className="h-4 w-4 text-white" />
          <Wifi strokeWidth={1} className="h-4 w-4 text-white" />
        </div>
        <div className="text-sm font-medium text-white">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-white">{Math.round(batteryLevel)}%</span>
          <div className="h-4 w-6 border border-white/40 rounded-sm relative">
            <div 
              className={cn(
                "absolute inset-0.5 rounded-sm",
                batteryLevel > 20 ? 'bg-white' : 'bg-violation'
              )}
              style={{ width: `${batteryLevel}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Camera View */}
      <div className="relative h-screen w-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* Top Info Bar */}
        <div className="absolute top-12 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-white font-medium">Monitoring Active</span>
          </div>
        </div>

        {/* Snapshot Counter */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
            <span className="text-xs text-white/80">Frames: <span className="text-white font-mono">{snapshotCount}</span></span>
          </div>
        </div>

        {/* Gyroscope Indicator */}
        <div className="absolute top-24 right-4 pointer-events-none">
          <div className={cn(
            'p-3 rounded-2xl backdrop-blur-sm transition-colors border',
            movementAlert ? 'bg-violation/80 border-violation/50' : 'bg-black/60 border-white/10'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <Move strokeWidth={1} className={cn(
                'h-4 w-4',
                movementAlert ? 'text-white' : 'text-cyan'
              )} />
              <span className={cn(
                'text-xs font-medium uppercase tracking-wider',
                movementAlert ? 'text-white' : 'text-cyan'
              )}>Gyro</span>
            </div>
            
            <div className="relative w-12 h-12 mx-auto">
              <div className="absolute inset-0 border border-white/20 rounded-full bg-black/20" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white/50 rounded-full" />
              <motion.div 
                className={cn(
                  "absolute w-2 h-2 rounded-full",
                  movementAlert ? "bg-white" : "bg-cyan"
                )}
                style={{
                  left: `calc(50% + ${Math.min(gyroData.x * 12, 20)}px)`,
                  top: `calc(50% + ${Math.min(gyroData.y * 12, 20)}px)`,
                }}
                animate={{
                  left: `calc(50% + ${Math.min(gyroData.x * 12, 20)}px)`,
                  top: `calc(50% + ${Math.min(gyroData.y * 12, 20)}px)`,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
            </div>
          </div>
        </div>

        {/* Movement Alert overlay */}
        <AnimatePresence>
          {movementAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-1/3 left-1/2 -translate-x-1/2 px-5 py-4 rounded-2xl bg-violation/90 backdrop-blur-md shadow-2xl border border-white/20 flex flex-col items-center pointer-events-none"
            >
              <div className="flex items-center gap-3 mb-1">
                <AlertTriangle className="h-6 w-6 text-white" />
                <span className="text-base font-bold text-white uppercase tracking-wider">Movement Detected</span>
              </div>
              <p className="text-sm text-white/90">Please keep the device stationary</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Controls */}
        <div className="absolute bottom-8 left-4 right-4">
          <div className="flex items-center justify-between">
            {/* Camera Switch */}
            <button
              onClick={switchCamera}
              className="h-14 w-14 rounded-full bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-lg"
            >
              <RefreshCw strokeWidth={1.5} className="h-6 w-6" />
            </button>

            {/* Recording Indicator */}
            <div className="flex items-center justify-center p-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/5">
               <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500/10 border border-red-500/20">
                 <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                 <span className="text-sm tracking-widest text-red-100 font-bold uppercase">Recording</span>
               </div>
            </div>

            {/* Empty space for flex spacing */}
            <div className="w-14 h-14" />
          </div>
        </div>
      </div>
    </div>
  );
}
