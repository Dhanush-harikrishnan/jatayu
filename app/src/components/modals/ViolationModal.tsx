import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, AlertTriangle, User, Clock, Camera, Brain,
  Activity, Video, BarChart3, Eye, Wifi, CheckCircle,
  Power, Triangle, Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentCard, Violation } from '@/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ViolationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentCard | null;
  violations: Violation[];
  onTerminate: (studentId: string) => void;
}

// Mock anomaly score data for chart
const mockAnomalyData = [
  { time: '10:00', score: 15 },
  { time: '10:05', score: 18 },
  { time: '10:10', score: 22 },
  { time: '10:15', score: 45 },
  { time: '10:20', score: 62 },
  { time: '10:25', score: 78 },
  { time: '10:30', score: 85 },
  { time: '10:35', score: 92 },
  { time: '10:40', score: 88 },
  { time: '10:45', score: 75 },
  { time: '10:50', score: 45 },
  { time: '10:55', score: 25 },
];

// Mock Rekognition metadata
const mockRekognitionData = {
  faceDetails: [
    {
      confidence: 98.5,
      emotions: [
        { type: 'CALM', confidence: 85.2 },
        { type: 'CONFUSED', confidence: 12.3 },
        { type: 'SURPRISED', confidence: 2.5 },
      ],
      eyeGaze: {
        yaw: -15.2,
        pitch: 8.5,
      },
      sunglasses: { value: false, confidence: 99.8 },
      eyeglasses: { value: true, confidence: 97.3 },
    },
  ],
  labels: [
    { name: 'Person', confidence: 99.2 },
    { name: 'Computer', confidence: 95.7 },
    { name: 'Desk', confidence: 88.3 },
    { name: 'Phone', confidence: 76.4 },
  ],
  moderation: [
    { name: 'Violence', confidence: 0.1 },
    { name: 'Explicit', confidence: 0.0 },
  ],
};

export function ViolationModal({ isOpen, onClose, student, violations, onTerminate }: ViolationModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'analysis'>('overview');
  const [selectedViolationIndex, setSelectedViolationIndex] = useState(0);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);

  if (!student) return null;

  const selectedViolation = violations[selectedViolationIndex];
  const anomalyScore = violations.reduce((sum, v) => {
    const weights: Record<string, number> = { low: 10, medium: 25, high: 50, critical: 100 };
    return sum + (weights[v.severity] || 10);
  }, 0);

  const handleTerminate = () => {
    onTerminate(student.studentId);
    setShowTerminateConfirm(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl bg-navy-900 border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-navy-800/50">
              <div className="flex items-center gap-4">
                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-navy-800">
                  {student.studentAvatar ? (
                    <img
                      src={student.studentAvatar}
                      alt={student.studentName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-6 w-6 text-white/20" />
                    </div>
                  )}
                  <span className={cn(
                    'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-navy-900',
                    student.status === 'online' && 'bg-success',
                    student.status === 'away' && 'bg-warning',
                    student.status === 'violation' && 'bg-violation',
                    student.status === 'offline' && 'bg-white/30'
                  )} />
                </div>
                <div>
                  <h2 className="font-sora text-lg font-semibold text-white">{student.studentName}</h2>
                  <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <span>{student.studentId}</span>
                    <span>•</span>
                    <span>{student.examTitle}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Anomaly Score Badge */}
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                  anomalyScore > 70 ? 'bg-violation/20 text-violation' :
                  anomalyScore > 40 ? 'bg-warning/20 text-warning' :
                  'bg-success/20 text-success'
                )}>
                  <Activity className="h-4 w-4" />
                  <span className="text-sm font-medium">Anomaly: {anomalyScore}%</span>
                </div>

                {/* Terminate Button */}
                <button
                  onClick={() => setShowTerminateConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violation/20 text-violation hover:bg-violation/30 transition-colors"
                >
                  <Power className="h-4 w-4" />
                  <span className="text-sm font-medium">Terminate</span>
                </button>

                <button
                  onClick={onClose}
                  className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 py-2 border-b border-white/10">
              {[
                { id: 'overview', label: 'Overview', icon: Eye },
                { id: 'timeline', label: 'Violation Timeline', icon: Clock },
                { id: 'analysis', label: 'AI Analysis', icon: Brain },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab.id 
                      ? 'bg-cyan/20 text-cyan' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-6 overflow-auto max-h-[calc(90vh-180px)]">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Live Feeds */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Webcam Feed */}
                    <div className="glass-card overflow-hidden">
                      <div className="flex items-center justify-between p-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-cyan" />
                          <span className="text-sm font-medium text-white">Webcam Feed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-violation animate-pulse" />
                          <span className="text-xs text-violation">LIVE</span>
                        </div>
                      </div>
                      <div className="relative aspect-video bg-navy-800">
                        {student.studentAvatar ? (
                          <img
                            src={student.studentAvatar}
                            alt={student.studentName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="h-16 w-16 text-white/20" />
                          </div>
                        )}
                        
                        {/* Face Detection Overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border-2 border-cyan/50 rounded-lg">
                            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan" />
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan" />
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan" />
                          </div>
                          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -mt-24">
                            <span className="px-2 py-1 rounded bg-cyan/20 text-cyan text-xs font-mono">
                              face: 98%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Feed */}
                    <div className="glass-card overflow-hidden">
                      <div className="flex items-center justify-between p-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-cyan" />
                          <span className="text-sm font-medium text-white">Mobile Camera</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                          <span className="text-xs text-success">ACTIVE</span>
                        </div>
                      </div>
                      <div className="relative aspect-video bg-navy-800">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Smartphone className="h-12 w-12 text-white/20 mx-auto mb-2" />
                            <p className="text-sm text-white/40">iPhone 13 Pro</p>
                            <p className="text-xs text-white/30 mt-1">Rear Camera • Gyro Active</p>
                          </div>
                        </div>
                        
                        {/* Room overlay markers */}
                        <div className="absolute inset-4 pointer-events-none">
                          <div className="absolute top-1/4 left-1/4 w-20 h-16 border border-cyan/30 rounded">
                            <span className="absolute -top-5 left-0 text-xs text-cyan/60">desk</span>
                          </div>
                          <div className="absolute top-1/3 right-1/4 w-16 h-12 border border-cyan/30 rounded">
                            <span className="absolute -top-5 left-0 text-xs text-cyan/60">laptop</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <QuickStat
                      icon={Clock}
                      label="Session Duration"
                      value="45m 32s"
                      color="cyan"
                    />
                    <QuickStat
                      icon={AlertTriangle}
                      label="Violations"
                      value={violations.length.toString()}
                      color={violations.length > 0 ? 'violation' : 'success'}
                    />
                    <QuickStat
                      icon={Activity}
                      label="Avg. Confidence"
                      value="94%"
                      color="success"
                    />
                    <QuickStat
                      icon={Wifi}
                      label="Connection"
                      value="Excellent"
                      color="success"
                    />
                  </div>

                  {/* Current Status */}
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-medium text-white mb-3">Real-time Telemetry</h3>
                    <div className="grid gap-3 md:grid-cols-5">
                      <TelemetryItem label="Face Detected" value="Yes" status="good" />
                      <TelemetryItem label="Gaze Direction" value="Center" status="good" />
                      <TelemetryItem label="Ambient Audio" value="28dB" status="good" />
                      <TelemetryItem label="Screen Focus" value="Active" status="good" />
                      <TelemetryItem label="Browser Tab" value="Exam" status="good" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-6">
                  {/* Violation Timeline */}
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-medium text-white mb-4">Violation Timeline</h3>
                    <div className="space-y-4">
                      {violations.length === 0 ? (
                        <div className="text-center py-8 text-text-secondary">
                          <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success/50" />
                          <p>No violations recorded</p>
                        </div>
                      ) : (
                        violations.map((violation, index) => (
                          <motion.div
                            key={violation.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={() => setSelectedViolationIndex(index)}
                            className={cn(
                              'flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all',
                              selectedViolationIndex === index 
                                ? 'bg-cyan/10 border border-cyan/30' 
                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                            )}
                          >
                            <div className={cn(
                              'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                              violation.severity === 'high' ? 'bg-violation/20' :
                              violation.severity === 'medium' ? 'bg-warning/20' :
                              'bg-cyan/20'
                            )}>
                              <AlertTriangle className={cn(
                                'h-5 w-5',
                                violation.severity === 'high' ? 'text-violation' :
                                violation.severity === 'medium' ? 'text-warning' :
                                'text-cyan'
                              )} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-white">{violation.description}</h4>
                                <span className="text-xs text-text-secondary">
                                  {violation.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <span className={cn(
                                  'text-xs px-2 py-0.5 rounded-full',
                                  violation.severity === 'high' ? 'bg-violation/20 text-violation' :
                                  violation.severity === 'medium' ? 'bg-warning/20 text-warning' :
                                  'bg-cyan/20 text-cyan'
                                )}>
                                  {violation.severity}
                                </span>
                                <span className="text-xs text-text-secondary">
                                  Confidence: {Math.round(violation.metadata.confidence * 100)}%
                                </span>
                                <span className="text-xs text-text-secondary">
                                  Anomaly Score: {violation.anomalyScore}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Selected Violation Detail */}
                  {selectedViolation && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="glass-card overflow-hidden">
                        <div className="p-3 border-b border-white/10">
                          <span className="text-sm font-medium text-white">Snapshot at Violation</span>
                        </div>
                        <div className="aspect-video bg-navy-800 flex items-center justify-center relative">
                          {student.studentAvatar ? (
                            <img
                              src={student.studentAvatar}
                              alt="Violation snapshot"
                              className="w-full h-full object-cover opacity-80"
                            />
                          ) : (
                            <Camera className="h-12 w-12 text-white/20" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="px-3 py-1.5 rounded bg-violation/80 text-white text-xs font-medium">
                              {selectedViolation.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="glass-card p-4">
                        <h4 className="text-sm font-medium text-white mb-3">Violation Details</h4>
                        <div className="space-y-3">
                          <DetailRow label="Type" value={selectedViolation.type} />
                          <DetailRow label="Description" value={selectedViolation.description} />
                          <DetailRow label="Severity" value={selectedViolation.severity} />
                          <DetailRow label="Timestamp" value={selectedViolation.timestamp.toLocaleString()} />
                          <DetailRow label="Anomaly Score" value={`${selectedViolation.anomalyScore}/100`} />
                          <DetailRow 
                            label="Confidence" 
                            value={`${Math.round(selectedViolation.metadata.confidence * 100)}%`} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  {/* Anomaly Score Chart */}
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-cyan" />
                        Anomaly Score Trend
                      </h3>
                      <span className="text-xs text-text-secondary">Last 1 hour</span>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mockAnomalyData}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis 
                            dataKey="time" 
                            stroke="rgba(255,255,255,0.3)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                          />
                          <YAxis 
                            stroke="rgba(255,255,255,0.3)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                            domain={[0, 100]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0F1D38',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                            }}
                            labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                            itemStyle={{ color: '#00F0FF' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="score"
                            stroke="#00F0FF"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorScore)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Rekognition Analysis */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Face Analysis */}
                    <div className="glass-card p-4">
                      <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <Brain className="h-4 w-4 text-cyan" />
                        Face Analysis (AWS Rekognition)
                      </h3>
                      
                      <div className="space-y-4">
                        {/* Confidence */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-text-secondary">Detection Confidence</span>
                            <span className="text-white">{mockRekognitionData.faceDetails[0].confidence}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-cyan rounded-full"
                              style={{ width: `${mockRekognitionData.faceDetails[0].confidence}%` }}
                            />
                          </div>
                        </div>

                        {/* Emotions */}
                        <div>
                          <span className="text-sm text-text-secondary">Detected Emotions</span>
                          <div className="mt-2 space-y-2">
                            {mockRekognitionData.faceDetails[0].emotions.map((emotion) => (
                              <div key={emotion.type} className="flex items-center justify-between">
                                <span className="text-sm text-white">{emotion.type}</span>
                                <span className="text-sm text-cyan">{emotion.confidence}%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Eye Gaze */}
                        <div>
                          <span className="text-sm text-text-secondary">Eye Gaze Direction</span>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="p-2 rounded bg-white/5">
                              <span className="text-xs text-text-secondary">Yaw</span>
                              <p className="text-sm text-white">{mockRekognitionData.faceDetails[0].eyeGaze.yaw}°</p>
                            </div>
                            <div className="p-2 rounded bg-white/5">
                              <span className="text-xs text-text-secondary">Pitch</span>
                              <p className="text-sm text-white">{mockRekognitionData.faceDetails[0].eyeGaze.pitch}°</p>
                            </div>
                          </div>
                        </div>

                        {/* Attributes */}
                        <div className="flex gap-2">
                          <span className={cn(
                            'px-2 py-1 rounded text-xs',
                            mockRekognitionData.faceDetails[0].eyeglasses.value 
                              ? 'bg-cyan/20 text-cyan' 
                              : 'bg-white/10 text-white/60'
                          )}>
                            Eyeglasses
                          </span>
                          <span className={cn(
                            'px-2 py-1 rounded text-xs',
                            mockRekognitionData.faceDetails[0].sunglasses.value 
                              ? 'bg-cyan/20 text-cyan' 
                              : 'bg-white/10 text-white/60'
                          )}>
                            Sunglasses
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Object Detection */}
                    <div className="glass-card p-4">
                      <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                        <Eye className="h-4 w-4 text-cyan" />
                        Object Detection
                      </h3>
                      
                      <div className="space-y-3">
                        {mockRekognitionData.labels.map((label) => (
                          <div key={label.name} className="flex items-center justify-between p-2 rounded bg-white/5">
                            <span className="text-sm text-white">{label.name}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-cyan rounded-full"
                                  style={{ width: `${label.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs text-cyan w-10 text-right">{label.confidence}%</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Content Moderation */}
                      <div className="mt-6">
                        <h4 className="text-sm text-text-secondary mb-3">Content Moderation</h4>
                        <div className="space-y-2">
                          {mockRekognitionData.moderation.map((item) => (
                            <div key={item.name} className="flex items-center justify-between p-2 rounded bg-white/5">
                              <span className="text-sm text-white">{item.name}</span>
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded',
                                item.confidence < 1 ? 'bg-success/20 text-success' : 'bg-violation/20 text-violation'
                              )}>
                                {item.confidence < 1 ? 'Clear' : 'Flagged'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Terminate Confirmation Modal */}
            <AnimatePresence>
              {showTerminateConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    className="glass-card p-6 max-w-md mx-4 border-violation/30"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-full bg-violation/20 flex items-center justify-center">
                        <Triangle className="h-6 w-6 text-violation" />
                      </div>
                      <div>
                        <h3 className="font-sora text-lg font-bold text-white">Terminate Session?</h3>
                        <p className="text-sm text-text-secondary">This action cannot be undone</p>
                      </div>
                    </div>
                    
                    <p className="text-white/80 mb-6">
                      You are about to terminate <strong>{student.studentName}'s</strong> exam session. 
                      This will immediately end their exam and log them out.
                    </p>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowTerminateConfirm(false)}
                        className="flex-1 btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleTerminate}
                        className="flex-1 bg-violation text-white px-4 py-2 rounded-xl font-medium hover:bg-violation/80 transition-colors"
                      >
                        Terminate Session
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface QuickStatProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'cyan' | 'success' | 'warning' | 'violation';
}

function QuickStat({ icon: Icon, label, value, color }: QuickStatProps) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3">
        <div className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center',
          color === 'cyan' && 'bg-cyan/10',
          color === 'success' && 'bg-success/10',
          color === 'warning' && 'bg-warning/10',
          color === 'violation' && 'bg-violation/10'
        )}>
          <Icon className={cn(
            'h-5 w-5',
            color === 'cyan' && 'text-cyan',
            color === 'success' && 'text-success',
            color === 'warning' && 'text-warning',
            color === 'violation' && 'text-violation'
          )} />
        </div>
        <div>
          <p className="text-xs text-text-secondary">{label}</p>
          <p className={cn(
            'font-sora text-lg font-semibold',
            color === 'cyan' && 'text-cyan',
            color === 'success' && 'text-success',
            color === 'warning' && 'text-warning',
            color === 'violation' && 'text-violation'
          )}>{value}</p>
        </div>
      </div>
    </div>
  );
}

interface TelemetryItemProps {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'error';
}

function TelemetryItem({ label, value, status }: TelemetryItemProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={cn(
        'text-sm font-medium',
        status === 'good' && 'text-success',
        status === 'warning' && 'text-warning',
        status === 'error' && 'text-violation'
      )}>{value}</span>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}
