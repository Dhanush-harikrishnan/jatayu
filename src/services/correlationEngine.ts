import { config } from '../config/env';
import { logger } from '../logger';
import { io } from '../socket';
import { awsService } from './awsService';

export interface TelemetryEvent {
  type: 'LAPTOP_FRAME' | 'MOBILE_FRAME' | 'KEYSTROKE' | 'TRANSCRIPT' | 'GYRO_MOTION';
  timestamp: number;
  data: any;
}

export class CorrelationEngine {
  private static instances = new Map<string, CorrelationEngine>();
  private events: TelemetryEvent[] = [];
  private sessionId: string;
  private windowMs = config.thresholds.correlationWindowMs;

  private constructor(sessionId: string) {
    this.sessionId = sessionId;
    // Periodically clean up old events
    setInterval(() => this.cleanOldEvents(), 1000);
  }

  public static getInstance(sessionId: string): CorrelationEngine {
    if (!this.instances.has(sessionId)) {
      this.instances.set(sessionId, new CorrelationEngine(sessionId));
    }
    return this.instances.get(sessionId)!;
  }

  public static removeInstance(sessionId: string) {
    this.instances.delete(sessionId);
  }

  public addEvent(event: TelemetryEvent) {
    this.events.push(event);
    this.evaluateRules();
  }

  private cleanOldEvents() {
    const now = Date.now();
    this.events = this.events.filter(e => now - e.timestamp <= this.windowMs);
  }

  private evaluateRules() {
    const now = Date.now();
    const windowEvents = this.events.filter(e => now - e.timestamp <= this.windowMs);

    // Rule 1: OFF_SCREEN_TYPING
    // Triggered if we get keystroke events but primary camera sees NO faces
    const keystrokesInWindow = windowEvents.filter(e => e.type === 'KEYSTROKE');
    const recentFrames = windowEvents.filter(e => e.type === 'LAPTOP_FRAME');
    
    if (keystrokesInWindow.length > 0 && recentFrames.length > 0) {
      const facesCount = recentFrames[recentFrames.length - 1].data.faceCount;
      if (facesCount === 0) {
        this.triggerCriticalViolation('OFF_SCREEN_TYPING');
      }
    }

    // Rule 2: SUSPECTED_TRANSCRIPTION (e.g., someone whispering an answer)
    // Audio transcript contains keywords while mobile frame doesn't see laptop screen properly
    const transcripts = windowEvents.filter(e => e.type === 'TRANSCRIPT');
    const mobileFrames = windowEvents.filter(e => e.type === 'MOBILE_FRAME');
    
    if (transcripts.length > 0) {
      const text = transcripts[transcripts.length - 1].data.text.toLowerCase();
      const suspiciousWords = ['help', 'answer', 'what is', 'tell me'];
      const hasSuspiciousText = suspiciousWords.some(w => text.includes(w));
      
      if (hasSuspiciousText) {
        this.triggerCriticalViolation('SUSPECTED_TRANSCRIPTION');
      }
    }

    // Rule 3: PHONE_MOVEMENT
    // High gyro deviation detected
    const gyroEvents = windowEvents.filter(e => e.type === 'GYRO_MOTION');
    if (gyroEvents.length > 0) {
      this.triggerCriticalViolation('PHONE_MOVEMENT_DETECTED');
    }
  }

  private async triggerCriticalViolation(violationType: string) {
    logger.warn(`[Violation] ${violationType} in session ${this.sessionId}`);

    // In a real app, you would snapshot the last base64 frame from state. 
    // Here we use a dummy s3Key logic for architecture adherence.
    const isoTimestamp = new Date().toISOString();
    const fakeS3Key = `evidence/${this.sessionId}/${isoTimestamp}.jpg`;
    
    try {
        await awsService.logViolationEvent(this.sessionId, isoTimestamp, violationType, fakeS3Key);
    } catch (e) {
        logger.error('DynamoDB Logging failed:', e);
    }

    // Emit to admin room
    if (io) {
      io.to('admin_room').emit('critical_violation', {
        sessionId: this.sessionId,
        violationType,
        timestamp: isoTimestamp,
        s3Key: fakeS3Key
      });
    }

    // Clear events to prevent duplicate triggers for the same incident
    this.events = [];
  }
}
