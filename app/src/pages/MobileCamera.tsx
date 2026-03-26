import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, RefreshCw, Wifi, Signal,
  Move, AlertTriangle, Smartphone,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileCameraProps {
  pairingCode?: string;
}

export function MobileCamera({ pairingCode = 'ABC123' }: MobileCameraProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [gyroData, setGyroData] = useState({ x: 0, y: 0, z: 0 });
  const [movementAlert, setMovementAlert] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Simulate connection
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnected(true);
      startCamera();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Gyroscope simulation
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      const newGyro = {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2,
      };
      setGyroData(newGyro);

      // Trigger movement alert on significant movement
      const magnitude = Math.sqrt(newGyro.x ** 2 + newGyro.y ** 2 + newGyro.z ** 2);
      if (magnitude > 1.5) {
        setMovementAlert(true);
        setTimeout(() => setMovementAlert(false), 3000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Battery simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setBatteryLevel(prev => Math.max(0, prev - 0.1));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  };

  const switchCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera switch failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <Signal className="h-4 w-4 text-white" />
          <Wifi className="h-4 w-4 text-white" />
        </div>
        <div className="text-sm font-medium text-white">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-white">{Math.round(batteryLevel)}%</span>
          <div className="h-4 w-6 border border-white/40 rounded-sm relative">
            <div 
              className="absolute inset-0.5 bg-white rounded-sm"
              style={{ width: `${batteryLevel}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Camera View */}
      <div className="relative h-screen w-full">
        {/* Camera Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* Connection Overlay */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-12 w-12 border-2 border-cyan border-t-transparent rounded-full"
              />
              <p className="mt-4 text-white font-medium">Connecting to exam...</p>
              <p className="text-sm text-white/60">Code: {pairingCode}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera Overlay UI */}
        {isConnected && (
          <>
            {/* Corner Markers */}
            <div className="absolute inset-4 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan/60" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan/60" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan/60" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan/60" />
            </div>

            {/* Positioning Guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/2 border border-dashed border-white/20 rounded-lg">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-xs text-white/40 uppercase tracking-wider">Position Desk Here</p>
                </div>
              </div>
            </div>

            {/* Top Info Bar */}
            <div className="absolute top-12 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-white">Connected</span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
                <Camera className="h-3 w-3 text-cyan" />
                <span className="text-xs text-white">Rear Camera</span>
              </div>
            </div>

            {/* Gyroscope Indicator */}
            <div className="absolute top-24 right-4">
              <div className={cn(
                'p-3 rounded-xl backdrop-blur-sm transition-colors',
                movementAlert ? 'bg-violation/80' : 'bg-black/60'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Move className={cn(
                    'h-4 w-4',
                    movementAlert ? 'text-white' : 'text-cyan'
                  )} />
                  <span className={cn(
                    'text-xs font-medium',
                    movementAlert ? 'text-white' : 'text-cyan'
                  )}>Gyroscope</span>
                </div>
                
                {/* Gyro visualization */}
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border border-white/20 rounded-full" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full" />
                  
                  {/* Center dot */}
                  <motion.div 
                    className="absolute w-2 h-2 bg-cyan rounded-full"
                    style={{
                      left: `calc(50% + ${gyroData.x * 20}px)`,
                      top: `calc(50% + ${gyroData.y * 20}px)`,
                    }}
                    animate={{
                      left: `calc(50% + ${gyroData.x * 20}px)`,
                      top: `calc(50% + ${gyroData.y * 20}px)`,
                    }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  />
                </div>
                
                <div className="mt-2 space-y-0.5 text-[10px] font-mono text-white/60">
                  <div className="flex justify-between">
                    <span>X:</span>
                    <span>{gyroData.x.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Y:</span>
                    <span>{gyroData.y.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Z:</span>
                    <span>{gyroData.z.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Movement Alert */}
            <AnimatePresence>
              {movementAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-1/3 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl bg-violation/90 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-white" />
                    <span className="text-sm font-medium text-white">Device Movement Detected</span>
                  </div>
                  <p className="text-xs text-white/80 mt-1">Please keep the device stationary</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Controls */}
            <div className="absolute bottom-8 left-4 right-4">
              <div className="flex items-center justify-between">
                {/* Camera Switch */}
                <button
                  onClick={switchCamera}
                  className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>

                {/* Recording Indicator */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-violation animate-pulse" />
                  <span className="text-xs text-white font-medium">LIVE</span>
                </div>

                {/* Info Button */}
                <button className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                  <Smartphone className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Positioning Arrows */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-48 h-48">
                <ChevronUp className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-6 text-white/30" />
                <ChevronDown className="absolute bottom-0 left-1/2 -translate-x-1/2 h-6 w-6 text-white/30" />
                <ChevronLeft className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-6 text-white/30" />
                <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6 text-white/30" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
