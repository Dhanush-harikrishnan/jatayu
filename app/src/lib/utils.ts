import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function formatTime(date: Date | string | number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

export function formatDate(date: Date | string | number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

export function getRelativeTime(date: Date | string | number): string {
  const dateObj = new Date(date);
  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateObj);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'online':
    case 'active':
    case 'completed':
      return 'bg-success';
    case 'away':
    case 'paused':
      return 'bg-warning';
    case 'violation':
    case 'terminated':
      return 'bg-violation';
    case 'offline':
    case 'upcoming':
      return 'bg-white/30';
    default:
      return 'bg-white/30';
  }
}

export function getViolationIcon(type: string): string {
  switch (type.toLowerCase()) {
    case 'multiple_faces':
    case 'multiple_persons_detected':
      return 'Users';
    case 'face_not_detected':
      return 'UserX';
    case 'looking_away':
      return 'EyeOff';
    case 'phone_detected':
      return 'Smartphone';
    case 'book_detected':
      return 'BookOpen';
    case 'person_left':
      return 'LogOut';
    case 'unauthorized_browser':
      return 'Globe';
    case 'copy_paste_attempt':
      return 'Copy';
    case 'screen_capture':
      return 'Monitor';
    case 'voice_detected':
      return 'Mic';
    case 'gyro_movement':
      return 'Move';
    default:
      return 'AlertTriangle';
  }
}

export function getViolationDescription(type: string): string {
  switch (type.toLowerCase()) {
    case 'tab_switch':
      return 'Navigated away from the exam tab';
    case 'copy_paste':
      return 'Attempted to copy or paste content';
    case 'multiple_faces':
    case 'multiple_persons_detected':
      return 'Multiple faces detected in frame';
    case 'face_not_detected':
      return 'Face not visible to camera';
    case 'looking_away':
      return 'Candidate looking away from screen';
    case 'phone_detected':
      return 'Mobile phone detected';
    case 'book_detected':
      return 'Unauthorized material detected';
    case 'person_left':
      return 'Candidate left the examination area';
    case 'unauthorized_browser':
      return 'Attempted to access unauthorized website';
    case 'copy_paste_attempt':
      return 'Copy/paste action blocked';
    case 'screen_capture':
      return 'Screen capture attempt detected';
    case 'voice_detected':
      return 'Voice/audio detected';
    case 'gyro_movement':
      return 'Significant device movement detected';
    default:
      return 'Suspicious activity detected';
  }
}

export function generatePairingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function calculateAnomalyScore(violations: any[]): number {
  if (violations.length === 0) return 0;
  const weights: Record<string, number> = { low: 10, medium: 25, high: 50, critical: 100 };
  const totalScore = violations.reduce((sum, v) => sum + (weights[v.severity] || 10), 0);
  return Math.min(100, totalScore);
}
