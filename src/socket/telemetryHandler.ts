import { Server, Socket } from 'socket.io';
import { CorrelationEngine } from '../services/correlationEngine';
import { awsService } from '../services/awsService';
import { analyzeKeystrokes } from '../services/keystrokeDynamics';
import { logger } from '../logger';
import { config } from '../config/env';

// Basic Token Bucket per operation type
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRatePerSec: number;

  constructor(capacity: number, refillRatePerSec: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.lastRefill = Date.now();
  }

  tryConsume(): boolean {
    const now = Date.now();
    const elapsedSecs = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSecs * this.refillRatePerSec);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

// Instantiate rate limiters using the env limit
const maxRps = config.aws?.rekognitionRpsLimit || 5;
const detectFacesLimiter = new TokenBucket(maxRps, maxRps);
const detectLabelsLimiter = new TokenBucket(maxRps, maxRps);

const lastPrimaryEvidenceUploadAt = new Map<string, number>();
const lastSecondaryEvidenceUploadAt = new Map<string, number>();

export const registerTelemetryHandlers = (io: Server, socket: Socket, roomName: string, engine: CorrelationEngine) => {
  // Video Frame ingestion
  socket.on('frame', async (data: { imageBase64: string, timestamp: number }) => {
    try {
      const { role } = socket.data.user;
      const sessionId: string = socket.data.user.sessionId;
      const buffer = Buffer.from(data.imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      
      if (role === 'primary') {
        // Upload a proof snapshot periodically; the correlation engine can attach the latest evidence to violations.
        let evidenceKey: string | undefined;
        const now = Date.now();
        const lastUploadAt = lastPrimaryEvidenceUploadAt.get(sessionId) || 0;
        if (now - lastUploadAt >= config.thresholds.evidenceUploadIntervalMs) {
          evidenceKey = `evidence/${sessionId}/primary/${data.timestamp}.jpg`;
          await awsService.uploadEvidenceToS3(evidenceKey, data.imageBase64);
          lastPrimaryEvidenceUploadAt.set(sessionId, now);
        }

        // Laptop camera -> Detect Faces
        if (!detectFacesLimiter.tryConsume()) {
          logger.debug('Rate limit exceeded for detectFaces, dropping frame.');
          return;
        }
        const res = await awsService.detectFaces(buffer);
        const faceCount = res.FaceDetails?.length || 0;
        const primaryFace = res.FaceDetails?.[0];

        const rekognitionMetadata = {
          confidence: primaryFace?.Confidence ? primaryFace.Confidence / 100 : 0.9,
          faceDetails:
            res.FaceDetails?.map(f => ({
              confidence: f.Confidence,
              emotions: f.Emotions?.map(e => ({ type: e.Type, confidence: e.Confidence })) || [],
              eyeGaze: { yaw: f.Pose?.Yaw, pitch: f.Pose?.Pitch },
              sunglasses: { value: f.Sunglasses?.Value, confidence: f.Sunglasses?.Confidence },
              eyeglasses: { value: f.Eyeglasses?.Value, confidence: f.Eyeglasses?.Confidence },
            })) || [],
          labels: [],
          moderation: [],
        };

        engine.addEvent({
          type: 'LAPTOP_FRAME',
          timestamp: data.timestamp,
          data: { faceCount, rekognitionMetadata },
          evidenceKey,
        });
      } else if (role === 'secondary_camera') {
        // The visual_frame handler (defined below) handles live preview
        // streaming to the desktop. This 'frame' handler only runs AI
        // analysis at 5s intervals.

        // Mobile camera -> Detect Labels
        if (!detectLabelsLimiter.tryConsume()) {
          logger.debug('Rate limit exceeded for detectLabels, dropping frame.');
          return;
        }
        const res = await awsService.detectLabels(buffer);
        const labels = res.Labels || [];

        // Ignore certain labels if necessary, but keep Person/Human to detect multiple people
        const filteredLabels = labels.filter(l =>
          l.Name !== 'Face' && l.Name !== 'Head'
        );

        // Multiple persons detection (allow 1 for the test taker themselves)
        const personLabels = filteredLabels.filter(l => 
          l.Name === 'Person' || l.Name === 'Human'
        );
        const personCount = personLabels.reduce((maxCount, l) => {
          return Math.max(maxCount, l.Instances?.length || 1);
        }, 0);
        const multiplePersonsDetected = personCount > 1;

        // Phone detection with stricter rules
        const phoneLabel = filteredLabels.find(l =>
          (l.Name === 'Cell Phone' || l.Name === 'Mobile Phone') && (l.Confidence ?? 0) > 75
        );

        // Count laptops (allow 1 — the student's own)
        const laptopLabels = filteredLabels.filter(l =>
          l.Name === 'Laptop' || l.Name === 'Computer' || l.Name === 'Monitor'
        );
        // Use instances count if available. Take the maximum across synonyms,
        // since Rekognition will return "Laptop", "Computer", and "Monitor" for the exact same object.
        const laptopCount = laptopLabels.reduce((maxCount, l) => {
          return Math.max(maxCount, l.Instances?.length || 1);
        }, 0);
        const hasLaptopScreen = laptopLabels.length > 0;

        // Book/Document detection
        const bookLabel = filteredLabels.find(l =>
          (l.Name === 'Book' || l.Name === 'Document' || l.Name === 'Paper' || l.Name === 'Textbook') && (l.Confidence ?? 0) > 75
        );

        const hasViolation = !!phoneLabel || !!bookLabel || laptopCount > 1 || multiplePersonsDetected;

        // Upload evidence: ALWAYS upload when a violation is detected, 
        // otherwise respect the periodic interval
        let evidenceKey: string | undefined;
        const now = Date.now();
        const lastUploadAt = lastSecondaryEvidenceUploadAt.get(sessionId) || 0;

        if (hasViolation) {
          // Force upload the violated frame so it's linked in DynamoDB
          evidenceKey = `evidence/${sessionId}/secondary/${data.timestamp}.jpg`;
          await awsService.uploadEvidenceToS3(evidenceKey, data.imageBase64);
          lastSecondaryEvidenceUploadAt.set(sessionId, now);
          logger.info(`[Mobile] Violation frame uploaded: ${evidenceKey}`);
        } else if (now - lastUploadAt >= config.thresholds.evidenceUploadIntervalMs) {
          // Periodic upload for non-violation frames
          evidenceKey = `evidence/${sessionId}/secondary/${data.timestamp}.jpg`;
          await awsService.uploadEvidenceToS3(evidenceKey, data.imageBase64);
          lastSecondaryEvidenceUploadAt.set(sessionId, now);
        }

        if (phoneLabel) {
          engine.addEvent({
            type: 'PHONE_DETECTED' as any,
            timestamp: data.timestamp,
            data: { label: phoneLabel.Name, confidence: phoneLabel.Confidence },
            evidenceKey, // Always linked since we force-uploaded above
          });
        }

        if (bookLabel) {
          engine.addEvent({
            type: 'BOOK_DETECTED' as any,
            timestamp: data.timestamp,
            data: { label: bookLabel.Name, confidence: bookLabel.Confidence },
            evidenceKey,
          });
        }

        if (multiplePersonsDetected) {
          // Send special event for multiple persons detected on mobile
          engine.addEvent({
            type: 'MOBILE_FRAME', // We can still use MOBILE_FRAME, we will pull personCount from data
            timestamp: data.timestamp,
            data: { hasLaptopScreen, laptopCount, personCount, multiplePersonsDetected: true },
            evidenceKey,
          });
        } else {
          engine.addEvent({
            type: 'MOBILE_FRAME',
            timestamp: data.timestamp,
            data: { hasLaptopScreen, laptopCount, personCount, multiplePersonsDetected: false },
            evidenceKey,
          });
        }
      }
    } catch (err) {
      logger.error('Error processing frame:', err);
    }
  });

  // Keystrokes ingestion
  socket.on('keystrokes', async (data: { vectors: number[], timestamp: number }) => {
    try {
      const sessionId: string = socket.data.user.sessionId;
      const score = await analyzeKeystrokes(sessionId, data.vectors);
      engine.addEvent({
        type: 'KEYSTROKE',
        timestamp: data.timestamp,
        data: { anomalyScore: score }
      });
    } catch (err) {
      logger.error('Error processing keystrokes:', err);
    }
  });

  // Audio / Transcription ingestion (Mocked audio transcript analysis)
  socket.on('audio_transcript', (data: { text: string, timestamp: number }) => {
    engine.addEvent({
      type: 'TRANSCRIPT',
      timestamp: data.timestamp,
      data: { text: data.text }
    });
  });

  // Lightweight visual-only frame relay (no AI analysis).
  // The mobile camera sends these at ~500ms intervals purely for the
  // desktop PiP preview so the secondary feed looks like live video
  // rather than choppy frame-by-frame updates.
  socket.on('visual_frame', (data: { imageBase64: string }) => {
    const { role } = socket.data.user;
    const sessionId: string = socket.data.user.sessionId;
    if (role === 'secondary_camera') {
      socket.to(roomName).emit('mobile_feed_frame', { imageBase64: data.imageBase64 });
      socket.to('admin_room').emit('admin_mobile_feed_frame', { sessionId, imageBase64: data.imageBase64 });
    }
  });

  // Gyro / Static Anchor ingestion
  socket.on('gyro_deviation', (data: { deviation: number, timestamp: number }) => {
    if (data.deviation > 1.5) { // Arbitrary threshold
      engine.addEvent({
        type: 'GYRO_MOTION',
        timestamp: data.timestamp,
        data: { deviation: data.deviation }
      });
    }
  });

  // Tab switch event (visibilitychange)
  socket.on('tab_switch', (data: { timestamp: number }) => {
    engine.addEvent({
      type: 'TAB_SWITCH',
      timestamp: data.timestamp,
      data: {}
    });
  });

  // Copy/Paste event
  socket.on('copy_paste', (data: { action: 'copy' | 'paste', timestamp: number }) => {
    engine.addEvent({
      type: 'COPY_PASTE',
      timestamp: data.timestamp,
      data: { action: data.action }
    });
  });
};
