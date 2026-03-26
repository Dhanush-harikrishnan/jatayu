import { Server, Socket } from 'socket.io';
import { CorrelationEngine } from '../services/correlationEngine';
import { awsService } from '../services/awsService';
import { analyzeKeystrokes } from '../services/keystrokeDynamics';
import { logger } from '../logger';

export const registerTelemetryHandlers = (io: Server, socket: Socket, roomName: string, engine: CorrelationEngine) => {
  // Video Frame ingestion
  socket.on('frame', async (data: { imageBase64: string, timestamp: number }) => {
    try {
      const { role } = socket.data.user;
      const buffer = Buffer.from(data.imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      
      if (role === 'primary') {
        // Laptop camera -> Detect Faces
        const res = await awsService.detectFaces(buffer);
        const faceCount = res.FaceDetails?.length || 0;
        engine.addEvent({
          type: 'LAPTOP_FRAME',
          timestamp: data.timestamp,
          data: { faceCount }
        });
      } else if (role === 'secondary_camera') {
        // Mobile camera -> Detect Labels
        const res = await awsService.detectLabels(buffer);
        const hasLaptopScreen = res.Labels?.some(l => l.Name === 'Laptop' || l.Name === 'Computer' || l.Name === 'Monitor') || false;
        engine.addEvent({
          type: 'MOBILE_FRAME',
          timestamp: data.timestamp,
          data: { hasLaptopScreen }
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
