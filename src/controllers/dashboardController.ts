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

export function resolveExamStatus(exam: any): 'upcoming' | 'active' | 'completed' {
  const now = Date.now();
  const startMs = new Date(exam.startTime).getTime();
  if (!Number.isFinite(startMs)) return 'upcoming';

  if (!exam.enabled) return 'upcoming';

  const endMs = exam.endTime ? new Date(exam.endTime).getTime() : startMs + exam.duration * 60 * 1000;
  if (now < startMs) return 'upcoming';
  if (now >= startMs && now <= endMs) return 'active';
  return 'completed';
}

function normalizeViolationType(raw: string): string {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'PHONE_DETECTED':
      return 'phone_detected';
    case 'BOOK_DETECTED':
      return 'book_detected';
    case 'MULTIPLE_PERSONS_DETECTED':
      return 'multiple_faces';
    case 'MULTIPLE_PERSONS_DETECTED_MOBILE':
      return 'multiple_faces_mobile';
    case 'MULTIPLE_LAPTOPS_DETECTED':
      return 'multiple_laptops';
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
    case 'multiple_faces_mobile':
    case 'phone_detected':
    case 'book_detected':
    case 'copy_paste_attempt':
    case 'voice_detected':
    case 'multiple_laptops':
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
    case 'multiple_faces_mobile':
      return 'Multiple persons detected via secondary camera';
    case 'multiple_laptops':
      return 'Multiple laptops/monitors detected via secondary camera';
    case 'face_not_detected':
      return 'Face not visible to camera';
    case 'looking_away':
      return 'Candidate looking away from screen';
    case 'phone_detected':
      return 'Mobile phone detected';
    case 'book_detected':
      return 'Book or document detected';
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

export const getViolationsBySession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const violations = await awsService.getViolationsBySessionId(sessionId);
    
    // We can directly map and return them, adding presigned URL or let frontend ask.
    // Instead of making the frontend ask per photo, let's just generate the presigned url here
    // for fewer round trips if there is an evidence key.
    const enriched = await Promise.all(violations.map(async (v) => {
      let evidenceUrl = '';
      if (v.evidenceKey) {
        try {
          evidenceUrl = await awsService.generateGetPresignedUrl(v.evidenceKey);
        } catch (e) {
          // ignore
        }
      }
      return {
        ...v,
        evidenceUrl
      };
    }));

    // Filter out non-violation events like EXAM_COMPLETED
    const finalViolations = enriched.filter(v => v.violationType && v.violationType !== 'SESSION_STARTED' && v.violationType !== 'EXAM_COMPLETED');

    return res.json({ success: true, data: finalViolations });
  } catch (err) {
    next(err);
  }
};

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
        setupEvidenceKey?: string;
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

      if (item.ViolationType?.S === 'SETUP_FACE_REFERENCE' && item.EvidenceKey?.S) {
        bySession.get(sessionId)!.setupEvidenceKey = item.EvidenceKey.S;
      }

      const isNonViolation = ['SESSION_STARTED', 'SETUP_FACE_REFERENCE'].includes(item.ViolationType?.S || '');
      bySession.get(sessionId)!.violationCount += (!isNonViolation && item.ViolationType?.S) ? 1 : 0;
    }

    const students = await Promise.all(Array.from(bySession.values()).map(async s => {
      let studentAvatar: string | undefined;
      if (s.setupEvidenceKey) {
        try {
          studentAvatar = await awsService.generateGetPresignedUrl(s.setupEvidenceKey);
        } catch (e) {
          studentAvatar = undefined;
        }
      }

      return {
        sessionId: s.sessionId,
        studentId: s.studentId,
        studentName: s.studentName,
        examTitle: s.examTitle,
        status: s.violationCount > 0 ? 'violation' : 'online',
        joinTime: new Date(s.firstTime).toISOString(),
        lastActivity: new Date(s.lastTime).toISOString(),
        violationCount: s.violationCount,
        studentAvatar,
      };
    }));

    const existingSessionIds = new Set(students.map((s: any) => s.sessionId));
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
        return vt && vt !== 'undefined' && vt !== 'TEST_VIOLATION' && vt !== 'SESSION_STARTED' && vt !== 'SETUP_FACE_REFERENCE';
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
    const examsList = await awsService.listExams();
    const exams = examsList.map(exam => ({
      ...exam,
      id: exam.examId,
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
    const current = await awsService.getExam(examId);

    if (!current) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    const { duration, startTime, enabled, requireFullscreen } = req.body || {};

    const updates: any = {};

    if (duration !== undefined) {
      const parsedDuration = Number(duration);
      if (!Number.isFinite(parsedDuration) || parsedDuration < 10 || parsedDuration > 480) {
        return res.status(400).json({ success: false, message: 'duration must be between 10 and 480 minutes' });
      }
      updates.duration = Math.round(parsedDuration);
    }

    if (startTime !== undefined) {
      const parsedStart = new Date(startTime).getTime();
      if (!Number.isFinite(parsedStart)) {
        return res.status(400).json({ success: false, message: 'startTime must be a valid ISO date string' });
      }
      updates.startTime = new Date(parsedStart).toISOString();
    }

    if (enabled !== undefined) {
      updates.enabled = Boolean(enabled);
    }

    if (requireFullscreen !== undefined) {
      updates.requireFullscreen = Boolean(requireFullscreen);
    }

    const updatedExam = await awsService.updateExam(examId, updates);

    res.json({
      success: true,
      message: 'Exam settings updated',
      data: {
        ...updatedExam,
        id: updatedExam.examId,
        status: resolveExamStatus(updatedExam),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const sendAdminExamNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const exam = await awsService.getExam(examId);
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
      `Exam update: ${exam.title} (${exam.examId})\nStart: ${exam.startTime}\nDuration: ${exam.duration} minutes\nEnabled: ${exam.enabled ? 'Yes' : 'No'}\nFullscreen required: ${exam.requireFullscreen ? 'Yes' : 'No'}`;

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
    const examsList = await awsService.listActiveExams();
    const exams = examsList.map(exam => ({
      id: exam.examId,
      title: exam.title,
      description: exam.description,
      startTime: exam.startTime,
      duration: exam.duration,
      totalQuestions: exam.totalQuestions || 0,
      status: resolveExamStatus(exam),
      instructions: exam.instructions || [],
      enabled: exam.enabled,
      requireFullscreen: exam.requireFullscreen,
      sections: exam.sections || [],
    }));
    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
};

export const createCustomExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payloadId = req.body.id || req.body.examId;
    const { title, description, duration, totalQuestions, instructions, requireFullscreen, sections } = req.body;

    if (!payloadId || !title || !duration) {
      return res.status(400).json({ success: false, message: 'ID (or examId), title, and duration are required' });
    }

    const safeDuration = Math.max(10, Math.min(480, Number(duration)));

    // Step 8: Validate startTime parseability
    const startTimeStr = req.body.startTime || new Date().toISOString();
    const startParse = Date.parse(startTimeStr);
    if (isNaN(startParse)) {
      return res.status(400).json({ success: false, message: 'Invalid startTime format. Must be an ISO string' });
    }
    const startTimeObj = new Date(startParse);
    const startTime = startTimeObj.toISOString();

    let endTime = req.body.endTime;
    if (!endTime) {
      const d = new Date(startTimeObj);
      d.setMinutes(d.getMinutes() + safeDuration);
      endTime = d.toISOString();
    } else {
      if (isNaN(Date.parse(endTime))) {
        return res.status(400).json({ success: false, message: 'Invalid endTime format. Must be an ISO string' });
      }
    }

    // Step 8: Reject negative totalQuestions
    const totalQ = Number(totalQuestions) || 10;
    if (totalQ < 0) {
      return res.status(400).json({ success: false, message: 'totalQuestions cannot be negative' });
    }

    // Step 8: Validate sections array structure
    if (sections && !Array.isArray(sections)) {
      return res.status(400).json({ success: false, message: 'Sections must be an array' });
    }

    const existingId = await awsService.getExam(payloadId);
    if (existingId) {
      return res.status(409).json({ success: false, message: `Exam with ID ${payloadId} already exists` });
    }

    const newConfig: any = {
      examId: payloadId,
      title,
      description: description || '',
      duration: safeDuration,
      totalQuestions: totalQ,
      instructions: Array.isArray(instructions) ? instructions : (instructions ? [instructions] : []),
      startTime,
      endTime,
      enabled: req.body.enabled !== false,
      requireFullscreen: requireFullscreen !== false,
      sections: sections || []
    };

    const savedExam = await awsService.createExam(newConfig);

    res.json({ success: true, message: 'Custom exam created successfully', data: { ...savedExam, id: savedExam.examId } });
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

    const sessionRecord = sessionRegistry.get(sessionId);
    const examId = sessionRecord?.examId;

    // 1. Delete all S3 evidence (primary + secondary + exam frames)
    let s3Deleted = 0;
    try {
      s3Deleted = await awsService.deleteSessionEvidence(sessionId, examId);
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
