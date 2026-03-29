import { Request, Response, NextFunction } from 'express';
import { awsService, dynamoClient } from '../services/awsService';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { config } from '../config/env';
import { sessionRegistry } from '../services/sessionRegistry';

type ExamConfig = {
  id: string;
  title: string;
  description: string;
  totalQuestions: number;
  instructions: string[];
  duration: number;
  startTime: string;
  enabled: boolean;
  requireFullscreen: boolean;
};

const examConfigs = new Map<string, ExamConfig>([
  [
    'EXAM-101',
    {
      id: 'EXAM-101',
      title: 'Introduction to Computer Science',
      description: 'Covers basic algorithms, data structures, and software engineering principles.',
      totalQuestions: 50,
      instructions: ['Ensure your webcam is on', 'Close all other applications', 'No bathroom breaks allowed'],
      duration: 120,
      startTime: new Date().toISOString(),
      enabled: true,
      requireFullscreen: true,
    },
  ],
  [
    'EXAM-102',
    {
      id: 'EXAM-102',
      title: 'Advanced Mathematics',
      description: 'Calculus, linear algebra, and discrete mathematics.',
      totalQuestions: 40,
      instructions: [],
      duration: 180,
      startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
      enabled: false,
      requireFullscreen: true,
    },
  ],
  [
    'PRACTICE-001',
    {
      id: 'PRACTICE-001',
      title: 'Practice: Networking Basics',
      description: 'Test your knowledge of fundamental networking concepts, protocols, and architecture.',
      totalQuestions: 5,
      instructions: ['This is a practice test — no proctoring violations will count', 'Take your time to review each question'],
      duration: 15,
      startTime: new Date().toISOString(),
      enabled: true,
      requireFullscreen: false,
    },
  ],
  [
    'PRACTICE-002',
    {
      id: 'PRACTICE-002',
      title: 'Practice: Operating Systems',
      description: 'Memory management, process scheduling, file systems and OS fundamentals.',
      totalQuestions: 5,
      instructions: ['Practice exam — all features are unlocked', 'Answers are not graded'],
      duration: 15,
      startTime: new Date().toISOString(),
      enabled: true,
      requireFullscreen: false,
    },
  ],
  [
    'PRACTICE-003',
    {
      id: 'PRACTICE-003',
      title: 'Practice: Database Design',
      description: 'SQL, relational models, normalization and database query optimization.',
      totalQuestions: 5,
      instructions: ['Practice exam', 'Use it to prepare for the main assessments'],
      duration: 15,
      startTime: new Date().toISOString(),
      enabled: true,
      requireFullscreen: false,
    },
  ],
  [
    'PRACTICE-004',
    {
      id: 'PRACTICE-004',
      title: 'Practice: Python Programming',
      description: 'Core Python syntax, data types, functions, and basic OOP concepts.',
      totalQuestions: 5,
      instructions: ['Practice exam', 'No live proctoring is applied for practice tests'],
      duration: 15,
      startTime: new Date().toISOString(),
      enabled: true,
      requireFullscreen: false,
    },
  ],
  [
    'PRACTICE-005',
    {
      id: 'PRACTICE-005',
      title: 'Practice: Cloud Computing',
      description: 'AWS, GCP, Azure services, cloud architecture, and deployment patterns.',
      totalQuestions: 5,
      instructions: ['Practice exam', 'Covers key cloud certification topics'],
      duration: 15,
      startTime: new Date().toISOString(),
      enabled: true,
      requireFullscreen: false,
    },
  ],
]);

function resolveExamStatus(exam: ExamConfig): 'upcoming' | 'active' | 'completed' {
  const now = Date.now();
  const startMs = new Date(exam.startTime).getTime();
  if (!Number.isFinite(startMs)) return 'upcoming';

  if (!exam.enabled) return 'upcoming';

  const endMs = startMs + exam.duration * 60 * 1000;
  if (now < startMs) return 'upcoming';
  if (now >= startMs && now <= endMs) return 'active';
  return 'completed';
}

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

      bySession.get(sessionId)!.violationCount += (item.ViolationType?.S && item.ViolationType.S !== 'SESSION_STARTED') ? 1 : 0;
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

    const existingSessionIds = new Set(students.map(s => s.sessionId));
    const registryOnlyStudents = sessionRegistry
      .list()
      .filter(s => !existingSessionIds.has(s.sessionId))
      .map(s => ({
        sessionId: s.sessionId,
        studentId: s.studentId,
        studentName: s.studentName,
        examTitle: s.examId,
        status: s.status,
        joinTime: s.joinTime,
        lastActivity: s.lastActivity,
        violationCount: 0,
      }));

    const mergedStudents = [...students, ...registryOnlyStudents]
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    res.json({ success: true, data: mergedStudents });
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
        return vt && vt !== 'undefined' && vt !== 'TEST_VIOLATION' && vt !== 'SESSION_STARTED';
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

export const getAdminExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exams = Array.from(examConfigs.values()).map(exam => ({
      ...exam,
      status: resolveExamStatus(exam),
    }));

    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
};

export const updateAdminExamSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const current = examConfigs.get(examId);

    if (!current) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    const { duration, startTime, enabled, requireFullscreen } = req.body || {};

    if (duration !== undefined) {
      const parsedDuration = Number(duration);
      if (!Number.isFinite(parsedDuration) || parsedDuration < 10 || parsedDuration > 480) {
        return res.status(400).json({ success: false, message: 'duration must be between 10 and 480 minutes' });
      }
      current.duration = Math.round(parsedDuration);
    }

    if (startTime !== undefined) {
      const parsedStart = new Date(startTime).getTime();
      if (!Number.isFinite(parsedStart)) {
        return res.status(400).json({ success: false, message: 'startTime must be a valid ISO date string' });
      }
      current.startTime = new Date(parsedStart).toISOString();
    }

    if (enabled !== undefined) {
      current.enabled = Boolean(enabled);
    }

    if (requireFullscreen !== undefined) {
      current.requireFullscreen = Boolean(requireFullscreen);
    }

    examConfigs.set(examId, current);

    res.json({
      success: true,
      message: 'Exam settings updated',
      data: {
        ...current,
        status: resolveExamStatus(current),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const sendAdminExamNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const exam = examConfigs.get(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    const { recipients, message } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'recipients must be a non-empty email array' });
    }

    const cleanRecipients = recipients
      .map((r: unknown) => (typeof r === 'string' ? r.trim() : ''))
      .filter((r: string) => r.length > 3 && r.includes('@'));

    if (cleanRecipients.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid recipient emails provided' });
    }

    const emailBody =
      message ||
      `Exam update: ${exam.title} (${exam.id})\nStart: ${exam.startTime}\nDuration: ${exam.duration} minutes\nEnabled: ${exam.enabled ? 'Yes' : 'No'}\nFullscreen required: ${exam.requireFullscreen ? 'Yes' : 'No'}`;

    const results = await Promise.allSettled(
      cleanRecipients.map(email => awsService.sendAdminNotificationEmail(email, emailBody))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - sent;

    if (sent === 0) {
      const firstFailure = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
      const reason = firstFailure?.reason;
      const messageText =
        reason?.message ||
        'Failed to send notification emails. Check AWS SES source email and recipient verification.';

      return res.status(502).json({
        success: false,
        message: messageText,
        sentTo: 0,
        failed,
      });
    }

    const summaryMessage =
      failed > 0
        ? `Email sent to ${sent} recipient(s); ${failed} failed.`
        : `Notification email sent to ${sent} recipient(s).`;

    res.json({ success: true, message: summaryMessage, sentTo: sent, failed });
  } catch (error) {
    next(error);
  }
};

export const getStudentExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exams = Array.from(examConfigs.values()).map(exam => ({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      startTime: exam.startTime,
      duration: exam.duration,
      totalQuestions: exam.totalQuestions,
      status: resolveExamStatus(exam),
      instructions: exam.instructions,
      enabled: exam.enabled,
      requireFullscreen: exam.requireFullscreen,
    }));
    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
};

export const createCustomExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, title, description, duration, totalQuestions, instructions, requireFullscreen } = req.body;

    if (!id || !title || !duration) {
      return res.status(400).json({ success: false, message: 'ID, title, and duration are required' });
    }

    if (examConfigs.has(id)) {
      return res.status(409).json({ success: false, message: `Exam with ID ${id} already exists` });
    }

    const newConfig: ExamConfig = {
      id,
      title,
      description: description || '',
      duration: Number(duration),
      totalQuestions: Number(totalQuestions) || 10,
      instructions: Array.isArray(instructions) ? instructions : (instructions ? [instructions] : []),
      startTime: req.body.startTime || new Date().toISOString(),
      enabled: req.body.enabled !== false,
      requireFullscreen: requireFullscreen !== false,
    };

    examConfigs.set(id, newConfig);

    res.json({ success: true, message: 'Custom exam created successfully', data: newConfig });
  } catch (error) {
    next(error);
  }
};

export const terminateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    // 1. Delete all S3 evidence (primary + secondary + exam frames)
    let s3Deleted = 0;
    try {
      s3Deleted = await awsService.deleteSessionEvidence(sessionId);
    } catch (err: any) {
      console.error(`[terminateSession] S3 cleanup failed: ${err?.message}`);
    }

    // 2. Delete all DynamoDB violation records
    let dbDeleted = 0;
    try {
      dbDeleted = await awsService.deleteSessionViolations(sessionId);
    } catch (err: any) {
      console.error(`[terminateSession] DynamoDB cleanup failed: ${err?.message}`);
    }

    // 3. Emit session-terminated event to the student's room via socket
    try {
      const { io } = require('../socket');
      if (io) {
        const roomName = `session_${sessionId}`;
        io.to(roomName).emit('session-terminated', {
          reason: 'Admin terminated your session',
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      console.error(`[terminateSession] Socket emit failed: ${err?.message}`);
    }

    // 4. Remove correlation engine instance
    try {
      const { CorrelationEngine } = require('../services/correlationEngine');
      CorrelationEngine.removeInstance(sessionId);
    } catch (err: any) {
      console.error(`[terminateSession] Engine removal failed: ${err?.message}`);
    }

    // 5. Fully remove from session registry so it doesn't reappear on dashboard poll
    sessionRegistry.remove(sessionId);

    res.json({
      success: true,
      message: `Session ${sessionId} terminated. Deleted ${s3Deleted} S3 objects and ${dbDeleted} DynamoDB records.`,
      s3Deleted,
      dbDeleted,
    });
  } catch (error) {
    next(error);
  }
};
