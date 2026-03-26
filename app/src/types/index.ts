// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
  avatar?: string;
}

export interface Student extends User {
  role: 'student';
  studentId: string;
  enrolledExams: string[];
}

export interface Admin extends User {
  role: 'admin';
  permissions: ('view' | 'manage' | 'terminate')[];
}

// Exam Types
export interface Exam {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  startTime: Date;
  endTime: Date;
  status: 'upcoming' | 'active' | 'completed';
  enabled?: boolean;
  requireFullscreen?: boolean;
  totalQuestions: number;
  passingScore: number;
  instructions: string[];
  allowedAttempts: number;
}

export interface ExamSession {
  id: string;
  examId: string;
  studentId: string;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  startTime?: Date;
  endTime?: Date;
  violations: Violation[];
  telemetry: TelemetryData;
}

// Violation Types
export interface Violation {
  id: string;
  sessionId: string;
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
  snapshotUrl?: string;
  metadata: ViolationMetadata;
  anomalyScore: number;
}

export type ViolationType = 
  | 'multiple_faces'
  | 'face_not_detected'
  | 'looking_away'
  | 'phone_detected'
  | 'book_detected'
  | 'person_left'
  | 'unauthorized_browser'
  | 'copy_paste_attempt'
  | 'screen_capture'
  | 'voice_detected'
  | 'gyro_movement';

export interface ViolationMetadata {
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  faceDetails?: {
    confidence: number;
    emotions: { type: string; confidence: number }[];
    eyeGaze: { yaw: number; pitch: number };
    sunglasses: { value: boolean; confidence: number };
    eyeglasses: { value: boolean; confidence: number };
  }[];
  labels?: { name: string; confidence: number }[];
  moderation?: any[];
  rekognitionData?: {
    faceDetails: any[];
    labels: any[];
  };
}

// Telemetry Types
export interface TelemetryData {
  timestamp: Date;
  faceDetected: boolean;
  faceConfidence: number;
  gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down';
  ambientNoise: number;
  screenActive: boolean;
  browserFocused: boolean;
  gyroData?: {
    x: number;
    y: number;
    z: number;
  };
}

// Proctoring Types
export interface ProctorStream {
  sessionId: string;
  studentName: string;
  studentAvatar?: string;
  webcamStream?: MediaStream;
  screenStream?: MediaStream;
  mobileStream?: MediaStream;
  status: 'online' | 'away' | 'violation' | 'offline';
  lastHeartbeat: Date;
}

export interface MobilePairing {
  sessionId: string;
  pairingCode: string;
  qrData: string;
  status: 'pending' | 'connected' | 'disconnected';
  deviceInfo?: {
    model: string;
    os: string;
    browser: string;
  };
}

// Admin Dashboard Types
export interface AdminDashboardStats {
  totalSessions: number;
  activeSessions: number;
  violationCount: number;
  avgSessionTime: number;
  anomalyRate: number;
}

export interface StudentCard {
  sessionId: string;
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  examTitle: string;
  status: 'online' | 'away' | 'violation' | 'offline';
  joinTime: Date;
  violationCount: number;
  thumbnailUrl?: string;
  lastActivity: Date;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'telemetry' | 'violation' | 'status_change' | 'heartbeat' | 'command' | 'error';
  payload: any;
  timestamp: Date;
}

export interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

// UI Types
export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}
