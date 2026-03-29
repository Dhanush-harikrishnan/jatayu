import { Server, Socket } from 'socket.io';
import { CorrelationEngine } from '../services/correlationEngine';
import { awsService } from '../services/awsService';
import { analyzeKeystrokes } from '../services/keystrokeDynamics';
import { logger } from '../logger';
import { config } from '../config/env';

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
        const res = await awsService.detectLabels(buffer);
        const labels = res.Labels || [];

        // Ignore Person/Human labels — the test-taker's body/hands are always visible
        const filteredLabels = labels.filter(l =>
          l.Name !== 'Person' && l.Name !== 'Human' && l.Name !== 'Face' && l.Name !== 'Head'
        );

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

        const hasViolation = !!phoneLabel || laptopCount > 1;

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

        engine.addEvent({
          type: 'MOBILE_FRAME',
          timestamp: data.timestamp,
          data: { hasLaptopScreen, laptopCount },
          evidenceKey,
        });
      }
    } catch (err) {
      logger.error('Error processing frame:', err);
    }
  });

  // Keystrokes ingestion
  socket.on('keystrokes', async (data: { vectors: number[], timestamp: number }) => {
    try {
      const score = await analyzeKeystrokes(data.vectors);
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
    if (role === 'secondary_camera') {
      socket.to(roomName).emit('mobile_feed_frame', { imageBase64: data.imageBase64 });
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
};
