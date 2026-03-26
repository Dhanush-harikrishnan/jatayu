import { Request, Response, NextFunction } from 'express';
import { awsService, dynamoClient } from '../services/awsService';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { config } from '../config/env';

function normalizeViolationType(raw: string): string {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'PHONE_DETECTED':
      return 'phone_detected';
    case 'MULTIPLE_PERSONS_DETECTED':
      return 'multiple_faces';
    case 'FACE_NOT_DETECTED':
      return 'face_not_detected';
    case 'LOOKING_AWAY':
      return 'looking_away';
    case 'OFF_SCREEN_TYPING':
      return 'copy_paste_attempt';
    case 'SUSPECTED_TRANSCRIPTION':
      return 'voice_detected';
    case 'PHONE_MOVEMENT_DETECTED':
      return 'gyro_movement';
    default:
      return (raw || '').toLowerCase();
  }
}

function severityForType(type: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (type) {
    case 'multiple_faces':
    case 'phone_detected':
    case 'copy_paste_attempt':
    case 'voice_detected':
      return 'high';
    case 'face_not_detected':
    case 'looking_away':
    case 'gyro_movement':
      return 'medium';
    default:
      return 'medium';
  }
}

function descriptionForType(type: string): string {
  switch (type) {
    case 'multiple_faces':
      return 'Multiple faces detected in frame';
    case 'face_not_detected':
      return 'Face not visible to camera';
    case 'looking_away':
      return 'Candidate looking away from screen';
    case 'phone_detected':
      return 'Mobile phone detected';
    case 'gyro_movement':
      return 'Significant device movement detected';
    case 'copy_paste_attempt':
      return 'Copy/paste action blocked';
    case 'voice_detected':
      return 'Voice/audio detected';
    default:
      return `Suspicious activity detected (${type})`;
  }
}

export const getAdminStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // We derive "active sessions" from the violation stream since there is no dedicated sessions table yet.
    // This also fixes the sessionId mismatch between `SecureGuardUsers` and `ProctoringEvents`.
    const command = new ScanCommand({ TableName: config.aws.dynamoDbTableName });
    const result = await dynamoClient.send(command);

    const bySession = new Map<
      string,
      {
        sessionId: string;
        studentId: string;
        studentName: string;
        examTitle: string;
        firstTime: number;
        lastTime: number;
        violationCount: number;
      }
    >();

    for (const item of (result.Items || []) as any[]) {
      const sessionId: string | undefined = item.SessionId?.S;
      const eventTimeStr: string | undefined = item.EventTime?.S;
      if (!sessionId || !eventTimeStr) continue;

      const t = new Date(eventTimeStr).getTime();
      if (Number.isNaN(t)) continue;

      const existing = bySession.get(sessionId);
      const studentId = item.UserId?.S || sessionId;
      const studentName = item.StudentName?.S || item.UserId?.S?.split('@')[0] || sessionId;
      const examTitle = item.ExamId?.S || 'EXAM-101';

      if (!existing) {
        bySession.set(sessionId, {
          sessionId,
          studentId,
          studentName,
          examTitle,
          firstTime: t,
          lastTime: t,
          violationCount: 0,
        });
      } else {
        existing.firstTime = Math.min(existing.firstTime, t);
        existing.lastTime = Math.max(existing.lastTime, t);
      }

      bySession.get(sessionId)!.violationCount += 1;
    }

    const students = Array.from(bySession.values()).map(s => ({
      sessionId: s.sessionId,
      studentId: s.studentId,
      studentName: s.studentName,
      examTitle: s.examTitle,
      status: s.violationCount > 0 ? 'violation' : 'online',
      joinTime: new Date(s.firstTime).toISOString(),
      lastActivity: new Date(s.lastTime).toISOString(),
      violationCount: s.violationCount,
    }));

    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

export const getAdminViolations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const command = new ScanCommand({
      TableName: config.aws.dynamoDbTableName
    });
    
    const result = await dynamoClient.send(command);

    const normalized = (result.Items || [])
      .filter((item: any) => {
        const vt = item.ViolationType?.S;
        return vt && vt !== 'undefined' && vt !== 'TEST_VIOLATION';
      })
      .map((item: any) => {
        const rawType: string = item.ViolationType?.S;
        const type = normalizeViolationType(rawType);
        const timestamp = item.EventTime?.S || new Date().toISOString();
        const severity = severityForType(type);
        return {
          id: `${item.SessionId?.S || 'unknown'}_${timestamp}_${rawType}`,
          sessionId: item.SessionId?.S || 'unknown-session',
          timestamp,
          type,
          severity,
          description: descriptionForType(type),
          status: 'unresolved',
          anomalyScore: severity === 'high' ? 85 : 60,
          metadata: item.Metadata?.S ? JSON.parse(item.Metadata.S) : { confidence: 1 },
          evidenceKey: item.EvidenceKey?.S,
        };
      });

    // Sort by newest first
    normalized.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit to avoid generating too many presigned URLs per request.
    const latest = normalized.slice(0, 80);

    const violations = await Promise.all(
      latest.map(async (v: any) => {
        let snapshotUrl: string | undefined;
        try {
          if (v.evidenceKey) snapshotUrl = await awsService.generateGetPresignedUrl(v.evidenceKey);
        } catch (e) {
          // Don't fail the whole endpoint if a single evidence object is missing.
          snapshotUrl = undefined;
        }

        return { ...v, snapshotUrl };
      })
    );

    res.json({ success: true, data: violations });
  } catch (error) {
    next(error);
  }
};

export const getStudentExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Returning a realistic exam payload until an Exams table is created
    const exams = [
      {
        id: 'EXAM-101',
        title: 'Introduction to Computer Science',
        description: 'Covers basic algorithms, data structures, and software engineering principles.',
        startTime: new Date().toISOString(),
        duration: 120,
        totalQuestions: 50,
        status: 'active',
        instructions: ['Ensure your webcam is on', 'Close all other applications', 'No bathroom breaks allowed']
      },
      {
        id: 'EXAM-102',
        title: 'Advanced Mathematics',
        description: 'Calculus, linear algebra, and discrete mathematics.',
        startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        duration: 180,
        totalQuestions: 40,
        status: 'upcoming',
        instructions: []
      }
    ];
    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
};
