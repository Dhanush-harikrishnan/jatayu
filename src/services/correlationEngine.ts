import { config } from '../config/env';
import { logger } from '../logger';
import { io } from '../socket';
import { awsService } from './awsService';
import { TrustScoreEngine } from './trustScoreEngine';

export interface TelemetryEvent {
  type: 'LAPTOP_FRAME' | 'MOBILE_FRAME' | 'KEYSTROKE' | 'TRANSCRIPT' | 'GYRO_MOTION' | 'PHONE_DETECTED' | 'BOOK_DETECTED' | 'TAB_SWITCH' | 'COPY_PASTE' | 'VM_DETECTED' | 'REMOTE_DESKTOP_DETECTED' | 'DEVTOOLS_DETECTED' | 'VOICE_DETECTED';
  timestamp: number;
  data: any;
  // Optional reference to an evidence image already stored in S3.
  evidenceKey?: string;
}

export class CorrelationEngine {
  private static instances = new Map<string, CorrelationEngine>();
  private events: TelemetryEvent[] = [];
  private sessionId: string;
  private windowMs = config.thresholds.correlationWindowMs;
  private lastPrimaryEvidenceKey?: string;
  private lastPrimaryMetadata?: any;
  private lastSecondaryEvidenceKey?: string;
  private lastSecondaryMetadata?: any;
  private context?: { userId?: string; studentName?: string; examId?: string };
  // Cooldown map: violationType -> last triggered epoch ms
  private violationCooldowns = new Map<string, number>();
  private readonly COOLDOWN_MS = 8000; // min 8 s between same violation type
  private cleanupInterval: NodeJS.Timeout;

  private constructor(
    sessionId: string,
    context?: { userId?: string; studentName?: string; examId?: string }
  ) {
    this.sessionId = sessionId;
    this.context = context;
    // Periodically clean up old events
    this.cleanupInterval = setInterval(() => this.cleanOldEvents(), 1000);
  }

  public static getInstance(
    sessionId: string,
    context?: { userId?: string; studentName?: string; examId?: string }
  ): CorrelationEngine {
    if (!this.instances.has(sessionId)) {
      this.instances.set(sessionId, new CorrelationEngine(sessionId, context));
    } else if (context) {
      // Update context if we learn it after first creation.
      const existing = this.instances.get(sessionId)!;
      existing.context = { ...(existing.context || {}), ...context };
    }
    return this.instances.get(sessionId)!;
  }

  public static destroyInstance(sessionId: string) {
    if (this.instances.has(sessionId)) {
      // Clean up the timer to prevent memory leaks
      const instance = this.instances.get(sessionId)!;
      if (instance.cleanupInterval) {
        clearInterval(instance.cleanupInterval);
      }
      this.instances.delete(sessionId);
    }
  }

  public static removeInstance(sessionId: string) {
    this.instances.delete(sessionId);
  }

  public addEvent(event: TelemetryEvent) {
    if (event.type === 'LAPTOP_FRAME' && event.evidenceKey) {
      this.lastPrimaryEvidenceKey = event.evidenceKey;
      if (event.data?.rekognitionMetadata) {
        this.lastPrimaryMetadata = event.data.rekognitionMetadata;
      }
    }
    if (event.type === 'MOBILE_FRAME' && event.evidenceKey) {
      this.lastSecondaryEvidenceKey = event.evidenceKey;
      if (event.data) {
        // we might have rekognitionMetadata or just generic data like laptopCount
        this.lastSecondaryMetadata = event.data.rekognitionMetadata || event.data;
      }
    }
    // Also capture special detection metadata from PHONE_DETECTED events
    if (event.type === 'PHONE_DETECTED' || event.type === 'BOOK_DETECTED') {
      if (event.evidenceKey) this.lastSecondaryEvidenceKey = event.evidenceKey;
      if (event.data) {
        this.lastSecondaryMetadata = { 
          label: event.data.label, 
          confidence: (event.data.confidence ?? 0) / 100 
        };
      }
    }
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
    const recentFrames = windowEvents.filter(e => e.type === 'LAPTOP_FRAME');
    const latestFrame = recentFrames.length > 0 ? recentFrames[recentFrames.length - 1] : null;

    if (latestFrame) {
      const faceCount: number = latestFrame.data.faceCount ?? 0;
      const faceDetails: any[] = latestFrame.data.rekognitionMetadata?.faceDetails ?? [];
      const primaryFace = faceDetails[0];

      // Rule A: MULTIPLE_PERSONS_DETECTED
      if (faceCount > 1) {
        this.triggerCriticalViolation('MULTIPLE_PERSONS_DETECTED');
      }

      // Rule B: FACE_NOT_DETECTED
      if (faceCount === 0) {
        this.triggerCriticalViolation('FACE_NOT_DETECTED');
      }

      // Rule C: LOOKING_AWAY (head pose yaw or pitch exceeds threshold)
      if (primaryFace) {
        const yaw = Math.abs(primaryFace.eyeGaze?.yaw ?? 0);
        const pitch = Math.abs(primaryFace.eyeGaze?.pitch ?? 0);
        const orientationThreshold = config.thresholds.facialOrientation ?? 25;
        if (yaw > orientationThreshold || pitch > orientationThreshold) {
          this.triggerCriticalViolation('LOOKING_AWAY');
        }
      }
    }

    // Rule D: OFF_SCREEN_TYPING (keystrokes while no face seen)
    const keystrokesInWindow = windowEvents.filter(e => e.type === 'KEYSTROKE');
    if (keystrokesInWindow.length > 0 && latestFrame) {
      const facesCount = latestFrame.data.faceCount ?? 0;
      if (facesCount === 0) {
        this.triggerCriticalViolation('OFF_SCREEN_TYPING');
      }
    }

    // Rule E: SUSPECTED_TRANSCRIPTION
    const transcripts = windowEvents.filter(e => e.type === 'TRANSCRIPT');
    if (transcripts.length > 0) {
      const text = transcripts[transcripts.length - 1].data.text.toLowerCase();
      const suspiciousWords = ['help', 'answer', 'what is', 'tell me'];
      if (suspiciousWords.some(w => text.includes(w))) {
        this.triggerCriticalViolation('SUSPECTED_TRANSCRIPTION');
      }
    }

    // Rule F: PHONE_MOVEMENT_DETECTED (gyro)
    const gyroEvents = windowEvents.filter(e => e.type === 'GYRO_MOTION');
    if (gyroEvents.length > 0) {
      this.triggerCriticalViolation('PHONE_MOVEMENT_DETECTED');
    }

    // Rule G: PHONE_DETECTED (label from mobile camera)
    const phoneEvents = windowEvents.filter(e => e.type === 'PHONE_DETECTED');
    if (phoneEvents.length > 0) {
      this.triggerCriticalViolation('PHONE_DETECTED');
    }
    // Rule G2: BOOK_DETECTED (label from mobile camera)
    const bookEvents = windowEvents.filter(e => e.type === 'BOOK_DETECTED');  
    if (bookEvents.length > 0) {
      this.triggerCriticalViolation('BOOK_DETECTED');
    }
    // Rule H: MULTIPLE_LAPTOPS_DETECTED (from mobile camera)
    const recentMobileFrames = windowEvents.filter(e => e.type === 'MOBILE_FRAME');
    const latestMobileFrame = recentMobileFrames.length > 0 ? recentMobileFrames[recentMobileFrames.length - 1] : null;
    if (latestMobileFrame && (latestMobileFrame.data.laptopCount || 0) > 1) {
      this.triggerCriticalViolation('MULTIPLE_LAPTOPS_DETECTED');
    }

    // Rule I: MULTIPLE_PERSONS_DETECTED_MOBILE (from mobile camera)
    if (latestMobileFrame && (latestMobileFrame.data.multiplePersonsDetected || false)) {
      this.triggerCriticalViolation('MULTIPLE_PERSONS_DETECTED_MOBILE');
    }

    // Rule J: TAB_SWITCH (visibilitychange)
    const tabSwitchEvents = windowEvents.filter(e => e.type === 'TAB_SWITCH');
    if (tabSwitchEvents.length > 0) {
      this.triggerCriticalViolation('TAB_SWITCH');
    }

    // Rule K: COPY_PASTE (clipboard usage)
    const copyPasteEvents = windowEvents.filter(e => e.type === 'COPY_PASTE');
    if (copyPasteEvents.length > 0) {
      this.triggerCriticalViolation('COPY_PASTE');
    }

      // Rule L: VM_DETECTED (Anti-Cheat)
      const vmEvents = windowEvents.filter(e => e.type === 'VM_DETECTED');
      if (vmEvents.length > 0) {
        this.triggerCriticalViolation('VM_DETECTED');
      }

      // Rule M: REMOTE_DESKTOP_DETECTED (Anti-Cheat)
      const rdpEvents = windowEvents.filter(e => e.type === 'REMOTE_DESKTOP_DETECTED');
      if (rdpEvents.length > 0) {
        this.triggerCriticalViolation('REMOTE_DESKTOP_DETECTED');
      }

      // Rule N: DEVTOOLS_DETECTED (Anti-Cheat)
      const devtoolsEvents = windowEvents.filter(e => e.type === 'DEVTOOLS_DETECTED');
      if (devtoolsEvents.length > 0) {
        this.triggerCriticalViolation('DEVTOOLS_DETECTED');
      }

      // Rule O: VOICE_DETECTED (Web Audio API)
      const voiceEvents = windowEvents.filter(e => e.type === 'VOICE_DETECTED');
      if (voiceEvents.length > 0) {
        this.triggerCriticalViolation('VOICE_DETECTED');
      }
    }

    private async triggerCriticalViolation(violationType: string) {
      // Cooldown check — avoid spamming the same violation type
      const lastTriggered = this.violationCooldowns.get(violationType) ?? 0;
      if (Date.now() - lastTriggered < this.COOLDOWN_MS) return;
      this.violationCooldowns.set(violationType, Date.now());

      logger.warn(`[Violation] ${violationType} in session ${this.sessionId}`);

      const isoTimestamp = new Date().toISOString();
    // Use the last known evidence key; fall back to a placeholder so the event still persists.
    // Select evidence key: mobile violations should prefer mobile snapshots
    const isMobileViolation = ['PHONE_DETECTED', 'BOOK_DETECTED', 'PHONE_MOVEMENT_DETECTED', 'MULTIPLE_LAPTOPS_DETECTED', 'MULTIPLE_PERSONS_DETECTED_MOBILE'].includes(violationType);
    const s3Key = (isMobileViolation ? this.lastSecondaryEvidenceKey : this.lastPrimaryEvidenceKey) 
                || this.lastPrimaryEvidenceKey 
                || this.lastSecondaryEvidenceKey
                || `evidence/${this.sessionId}/no-evidence/${Date.now()}.jpg`;

    const metadata = (isMobileViolation ? this.lastSecondaryMetadata : this.lastPrimaryMetadata)
                  || this.lastPrimaryMetadata
                  || this.lastSecondaryMetadata;

    try {
      await awsService.logViolationEvent(
        this.sessionId,
        isoTimestamp,
        violationType,
        s3Key,
        metadata,
        this.context
      );
      logger.info(`[Violation] Logged to DynamoDB: ${violationType} session=${this.sessionId} key=${s3Key}`);
    } catch (e) {
      logger.error('DynamoDB Logging failed:', e);
    }
    
    // Update Trust Score Engine
    const trustEngine = TrustScoreEngine.getInstance(this.sessionId);
    const newScore = trustEngine.processEvent({ type: violationType });

    // Emit to admin room
    if (io) {
      io.to('admin_room').emit('critical_violation', {
        sessionId: this.sessionId,
        violationType,
        timestamp: isoTimestamp,
        s3Key
      });
      
      io.to('admin_room').emit('trust_score_update', {
        sessionId: this.sessionId,
        score: newScore,
        timestamp: isoTimestamp
      });

      // Also emit to the student's session room so the primary screen shows the alert
      if (isMobileViolation) {
        io.to(`session_${this.sessionId}`).emit('mobile_violation', {
          violationType,
          timestamp: isoTimestamp,
          s3Key,
        });
      }
    }

    // Clear events to prevent duplicate triggers for the same incident
    this.events = [];
  }
}

