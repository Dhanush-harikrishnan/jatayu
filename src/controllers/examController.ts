import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../utils/jwt';
import { awsService } from '../services/awsService';
import { config } from '../config/env';

import { logger } from '../logger';

const normalizeEvidenceKey = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith('s3://')) {
    const prefix = `s3://${config.aws.s3Bucket}/`;
    if (value.startsWith(prefix)) {
      return value.substring(prefix.length);
    }
    const parts = value.replace('s3://', '').split('/');
    return parts.slice(1).join('/');
  }
  return value;
};

export const getPresignedUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const { filename } = req.body;
    const userSession = req.user;

    if (userSession?.examId !== examId) {
       return res.status(403).json({ success: false, message: 'Exam ID mismatch' });
    }

    const s3Key = `exams/${examId}/${userSession.sessionId}/${Date.now()}_${filename}`;
    const url = await awsService.generatePresignedUrl(s3Key);

    res.json({ success: true, url, s3Key });
  } catch (error) {
    next(error);
  }
};

export const analyzeFrame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const { s3Key } = req.body;
    const userSession = req.user;

    if (userSession?.examId !== examId) {
       return res.status(403).json({ success: false, message: 'Exam ID mismatch' });
    }

    // Download the image bytes from S3 and send them directly to Rekognition
    // (S3 is in ap-south-2 but Rekognition is in ap-south-1, so S3Object refs fail cross-region)
    const imageBytes = await awsService.getEvidenceObjectBytes(s3Key);

    const [labelsRes, facesRes] = await Promise.all([
      awsService.detectLabels(imageBytes),
      awsService.detectFaces(imageBytes)
    ]);

    const hasPhone = labelsRes.Labels?.some(l => 
      ['Phone', 'Cell Phone', 'Mobile Phone', 'Electronics', 'Electronics Device'].includes(l.Name || '')
    );
    const faceCount = facesRes.FaceDetails?.length || 0;
    const multipleFaces = (facesRes.FaceDetails?.length || 0) > 1;
    const noFace = (facesRes.FaceDetails?.length || 0) === 0;
    
    // Head Pose tracking
    let isLookingAway = false;
    const primaryFace = facesRes.FaceDetails?.[0];
    if (primaryFace && primaryFace.Pose) {
      const yaw = Math.abs(primaryFace.Pose.Yaw || 0);
      const pitch = Math.abs(primaryFace.Pose.Pitch || 0);
      // Read threshold from config or default to 25 degrees
      const threshold = parseFloat(process.env.FACIAL_ORIENTATION_THRESHOLD || '25');
      if (yaw > threshold || pitch > threshold) {
        isLookingAway = true;
      }
    }

    if (hasPhone || multipleFaces || noFace || isLookingAway) {
      let violationType = 'UNKNOWN';
      if (hasPhone) violationType = 'phone_detected';
      else if (multipleFaces) violationType = 'multiple_faces';
      else if (noFace) violationType = 'face_not_detected';
      else if (isLookingAway) violationType = 'looking_away';

      const timestamp = new Date().toISOString();
      const metadata = {
        confidence: primaryFace?.Confidence ? primaryFace.Confidence / 100 : 0.9,
        faceDetails: facesRes.FaceDetails?.map(f => ({
          confidence: f.Confidence,
          emotions: f.Emotions?.map(e => ({ type: e.Type, confidence: e.Confidence })) || [],
          eyeGaze: { yaw: f.Pose?.Yaw, pitch: f.Pose?.Pitch },
          sunglasses: { value: f.Sunglasses?.Value, confidence: f.Sunglasses?.Confidence },
          eyeglasses: { value: f.Eyeglasses?.Value, confidence: f.Eyeglasses?.Confidence }
        })) || [],
        labels: labelsRes.Labels?.map(l => ({ name: l.Name, confidence: l.Confidence })) || [],
        moderation: []
      };
      
      const context: any = {
        userId: userSession.userId,
        studentName: (userSession as any).name,
        examId: userSession.examId,
      };

      await awsService.logViolationEvent(
        userSession.sessionId,
        timestamp,
        violationType,
        s3Key,
        metadata,
        context
      );

      // Send SES email to admin
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@institution.edu';
      const emailBody = `A critical violation was detected in session ${userSession.sessionId}.\nViolation Type: ${violationType}\nTimestamp: ${timestamp}\nEvidence: s3://${config.aws.s3Bucket}/${s3Key}`;
      await awsService.sendMagicLinkEmail(adminEmail, emailBody).catch(e => {
        logger.error('Failed to send admin notification email', e);
      });

      logger.warn(`Violation detected for session ${userSession.sessionId}: ${violationType}`);
      res.json({ success: true, violationDetected: true, violationType, s3Key, metadata });
    } else {
      res.json({ success: true, violationDetected: false });
    }
  } catch (error) {
    next(error);
  }
};

export const analyzeSetupFrame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const { imageBase64 } = req.body;
    const userSession = req.user;

    if (userSession?.examId !== examId) {
      return res.status(403).json({ success: false, message: 'Exam ID mismatch' });
    }
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, message: 'imageBase64 is required' });
    }

    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    // Save to the evidence/ folder so that `deleteSessionEvidence` can clean it up automatically
    const s3Key = `evidence/${userSession.sessionId}/setup/${Date.now()}_setup-frame.jpg`;

    // Step 1: Upload to S3
    try {
      await awsService.uploadEvidenceToS3(s3Key, imageBase64);
    } catch (s3Err: any) {
      logger.error(`[analyzeSetupFrame] S3 upload failed: [${s3Err?.name}] ${s3Err?.message}`);
      // Continue without S3 upload — Rekognition can still analyze via bytes
    }

    // Step 2: Call Rekognition with raw bytes (no S3 dependency)
    let labelsRes: any = { Labels: [] };
    let facesRes: any = { FaceDetails: [] };
    try {
      [labelsRes, facesRes] = await Promise.all([
        awsService.detectLabels(buffer),
        awsService.detectFaces(buffer),
      ]);
    } catch (rekErr: any) {
      logger.error(`[analyzeSetupFrame] Rekognition failed: [${rekErr?.name}] ${rekErr?.message}`);
      // Return a graceful response instead of crashing
      return res.json({
        success: true,
        violationDetected: false,
        faceCount: 0,
        faceDetected: false,
        warning: `Face detection temporarily unavailable: ${rekErr?.name || 'Unknown error'}`,
      });
    }

    const hasPhone = labelsRes.Labels?.some((l: any) =>
      ['Phone', 'Cell Phone', 'Mobile Phone', 'Electronics', 'Electronics Device'].includes(l.Name || '')
    );
    const faceCount = facesRes.FaceDetails?.length || 0;
    const multipleFaces = (facesRes.FaceDetails?.length || 0) > 1;
    const noFace = (facesRes.FaceDetails?.length || 0) === 0;

    let isLookingAway = false;
    const primaryFace = facesRes.FaceDetails?.[0];
    const primaryFaceConfidence = (primaryFace?.Confidence || 0) / 100;
    const faceDetected = faceCount > 0 && primaryFaceConfidence >= 0.9;
    if (primaryFace?.Pose) {
      const yaw = Math.abs(primaryFace.Pose.Yaw || 0);
      const pitch = Math.abs(primaryFace.Pose.Pitch || 0);
      const threshold = config.thresholds.facialOrientation;
      if (yaw > threshold || pitch > threshold) {
        isLookingAway = true;
      }
    }

    if (hasPhone || multipleFaces || noFace || isLookingAway) {
      let violationType = 'UNKNOWN';
      if (hasPhone) violationType = 'phone_detected';
      else if (multipleFaces) violationType = 'multiple_faces';
      else if (noFace) violationType = 'face_not_detected';
      else if (isLookingAway) violationType = 'looking_away';

      const timestamp = new Date().toISOString();
      const metadata = {
        confidence: primaryFace?.Confidence ? primaryFace.Confidence / 100 : 0.9,
        faceDetails: facesRes.FaceDetails?.map((f: any) => ({
          confidence: f.Confidence,
          emotions: f.Emotions?.map((e: any) => ({ type: e.Type, confidence: e.Confidence })) || [],
          eyeGaze: { yaw: f.Pose?.Yaw, pitch: f.Pose?.Pitch },
          sunglasses: { value: f.Sunglasses?.Value, confidence: f.Sunglasses?.Confidence },
          eyeglasses: { value: f.Eyeglasses?.Value, confidence: f.Eyeglasses?.Confidence }
        })) || [],
        labels: labelsRes.Labels?.map((l: any) => ({ name: l.Name, confidence: l.Confidence })) || [],
        moderation: []
      };

      // Step 3: Log violation to DynamoDB (non-blocking)
      try {
        await awsService.logViolationEvent(
          userSession.sessionId,
          timestamp,
          violationType,
          s3Key,
          metadata,
          {
            userId: userSession.userId,
            studentName: (userSession as any).name,
            examId: userSession.examId,
          }
        );
      } catch (dbErr: any) {
        logger.error(`[analyzeSetupFrame] DynamoDB logViolation failed: [${dbErr?.name}] ${dbErr?.message}`);
        // Don't crash the response — violation was still detected
      }

      return res.json({
        success: true,
        violationDetected: true,
        violationType,
        s3Key,
        metadata,
        faceCount,
        faceDetected,
      });
    }

    // Always log the setup face reference image so we have an avatar!
    const timestamp = new Date().toISOString();
    const metadata = {
      confidence: primaryFace?.Confidence ? primaryFace.Confidence / 100 : 0.9,
      faceDetails: facesRes.FaceDetails?.map((f: any) => ({
        confidence: f.Confidence,
        emotions: f.Emotions?.map((e: any) => ({ type: e.Type, confidence: e.Confidence })) || [],
        eyeGaze: { yaw: f.Pose?.Yaw, pitch: f.Pose?.Pitch },
        sunglasses: { value: f.Sunglasses?.Value, confidence: f.Sunglasses?.Confidence },
        eyeglasses: { value: f.Eyeglasses?.Value, confidence: f.Eyeglasses?.Confidence }
      })) || [],
      labels: labelsRes.Labels?.map((l: any) => ({ name: l.Name, confidence: l.Confidence })) || [],
      moderation: []
    };
    try {
      await awsService.logViolationEvent(
        userSession.sessionId,
        timestamp,
        'SETUP_FACE_REFERENCE',
        s3Key,
        metadata,
        {
          userId: userSession.userId,
          studentName: (userSession as any).name,
          examId: userSession.examId,
        }
      );
    } catch (dbErr: any) {
      logger.error(`[analyzeSetupFrame] DynamoDB log SETUP_FACE_REFERENCE failed: [${dbErr?.name}] ${dbErr?.message}`);
    }

    return res.json({
      success: true,
      violationDetected: false,
      s3Key,
      faceCount,
      faceDetected,
    });
  } catch (error: any) {
    logger.error(`[analyzeSetupFrame] Unhandled error: [${error?.name}] ${error?.message}`);
    next(error);
  }
};

export const analyzeLiveFrame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const { imageBase64 } = req.body;
    const userSession = req.user;

    if (userSession?.examId !== examId) {
      return res.status(403).json({ success: false, message: 'Exam ID mismatch' });
    }
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, message: 'imageBase64 is required' });
    }

    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    // Save to the evidence/ folder so that `deleteSessionEvidence` can clean it up automatically
    const s3Key = `evidence/${userSession.sessionId}/live/${Date.now()}_live-frame.jpg`;

    await awsService.uploadEvidenceToS3(s3Key, imageBase64);

    const [labelsRes, facesRes] = await Promise.all([
      awsService.detectLabels(buffer),
      awsService.detectFaces(buffer),
    ]);

    const hasPhone = labelsRes.Labels?.some(l =>
      ['Phone', 'Cell Phone', 'Mobile Phone', 'Electronics', 'Electronics Device'].includes(l.Name || '')
    );
    const multipleFaces = (facesRes.FaceDetails?.length || 0) > 1;
    const noFace = (facesRes.FaceDetails?.length || 0) === 0;

    let isLookingAway = false;
    const primaryFace = facesRes.FaceDetails?.[0];
    if (primaryFace?.Pose) {
      const yaw = Math.abs(primaryFace.Pose.Yaw || 0);
      const pitch = Math.abs(primaryFace.Pose.Pitch || 0);
      const threshold = config.thresholds.facialOrientation;
      if (yaw > threshold || pitch > threshold) {
        isLookingAway = true;
      }
    }

    if (hasPhone || multipleFaces || noFace || isLookingAway) {
      let violationType = 'UNKNOWN';
      if (hasPhone) violationType = 'phone_detected';
      else if (multipleFaces) violationType = 'multiple_faces';
      else if (noFace) violationType = 'face_not_detected';
      else if (isLookingAway) violationType = 'looking_away';

      const timestamp = new Date().toISOString();
      const metadata = {
        confidence: primaryFace?.Confidence ? primaryFace.Confidence / 100 : 0.9,
        faceDetails: facesRes.FaceDetails?.map(f => ({
          confidence: f.Confidence,
          emotions: f.Emotions?.map(e => ({ type: e.Type, confidence: e.Confidence })) || [],
          eyeGaze: { yaw: f.Pose?.Yaw, pitch: f.Pose?.Pitch },
          sunglasses: { value: f.Sunglasses?.Value, confidence: f.Sunglasses?.Confidence },
          eyeglasses: { value: f.Eyeglasses?.Value, confidence: f.Eyeglasses?.Confidence }
        })) || [],
        labels: labelsRes.Labels?.map(l => ({ name: l.Name, confidence: l.Confidence })) || [],
        moderation: []
      };

      await awsService.logViolationEvent(
        userSession.sessionId,
        timestamp,
        violationType,
        s3Key,
        metadata,
        {
          userId: userSession.userId,
          studentName: (userSession as any).name,
          examId: userSession.examId,
        }
      );

      return res.json({ success: true, violationDetected: true, violationType, s3Key, metadata });
    }

    return res.json({ success: true, violationDetected: false, s3Key });
  } catch (error) {
    next(error);
  }
};

// Note: `sendExamReport` was imported up above, so let's make sure things are clean
import { generatePdfReport } from '../services/pdfService';
import { io } from '../socket';
import { CorrelationEngine } from '../services/correlationEngine';

export const submitExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const userSession = req.user;

    if (!userSession) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (userSession.examId !== examId) {
       return res.status(403).json({ success: false, message: 'Exam ID mismatch' });
    }

    const { sessionId, userId } = userSession;
    const email = userId || 'unknown@domain.com';
    const name = userId || 'Unknown Student';
    
    const { answers = {}, autoSubmitted = false } = req.body;

    let score = 0;
    let totalPoints = 0;
    const timestamp = new Date().toISOString();

    try {
      const questions = await awsService.getQuestionsByExamId(examId);
      for (const q of questions) {
        if (q.sectionType !== 'CODING') {
          totalPoints += (q.points || 1);
          // Compare answers checking for string conversions occasionally
          if (String(answers[q.id || q.questionId]) === String(q.correctAnswer)) {
            score += (q.points || 1);
          }
        }
      }

      await awsService.createSubmission({
        submissionId: `SUB-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        sessionId,
        examId,
        studentId: email,
        answers,
        score,
        totalPoints,
        submittedAt: timestamp,
        autoSubmitted
      });
    } catch (dbErr) {
      logger.error(`Error calculating score or saving submission for session ${sessionId}:`, dbErr);
    }

    // 1. Mark session logic (log an EXAM_COMPLETED event since we don't have a sessions table)
    await awsService.logViolationEvent(
      sessionId,
      timestamp,
      'EXAM_COMPLETED',
      '',
      { status: 'COMPLETED', score, totalPoints },
      { userId: email, studentName: name, examId }
    );

    // 2. Clear out CorrelationEngine to stop processing late incoming frames
    CorrelationEngine.destroyInstance(sessionId);

    // 3. Emit `exam-ended`
    if (io) {
      io.to(`session_${sessionId}`).emit('exam-ended', { 
        sessionId,
        examId,
        timestamp 
      });
    }

    // 4. Trigger PDF generation & Email Report
    // By re-using the logic from sendExamReport
    try {
      const dbViolations = await awsService.getViolationsBySessionId(sessionId).catch(() => []);
      const filteredDbViolations = dbViolations.filter((v: any) => v.violationType && v.violationType !== 'SESSION_STARTED' && v.violationType !== 'EXAM_COMPLETED');
      const sourceViolations = filteredDbViolations.map((v: any) => ({
        type: v.violationType || 'unknown',
        timestamp: v.timestamp || timestamp,
        evidence: v.evidenceKey,
        metadata: v.metadata,
      }));

      const violationsWithEvidence = await Promise.all(
        sourceViolations.map(async (v: any) => {
          const evidenceKey = normalizeEvidenceKey(v.evidence);
          let evidenceImage: Buffer | undefined;
          if (evidenceKey) {
            try {
              evidenceImage = await awsService.getEvidenceObjectBytes(evidenceKey);
            } catch (err) {
              logger.warn(`Unable to fetch evidence image for report: ${evidenceKey}`);
            }
          }

          return {
            type: v.type,
            timestamp: v.timestamp,
            evidence: evidenceKey || v.evidence,
            metadata: v.metadata,
            evidenceImage,
          };
        })
      );

      const pdfBuffer = await generatePdfReport({
        examId,
        sessionId,
        studentEmail: email,
        score,
        totalPoints,
        violations: violationsWithEvidence,
      });

      const adminEmail = process.env.ADMIN_EMAIL || config.aws.sesSourceEmail || email;
      await awsService.sendPdfReportEmail(
        adminEmail,
        pdfBuffer,
        `Exam Report - ${examId} - ${email}`,
        `Please find attached the proctoring report for session ${sessionId}.`
      );
      logger.info(`Report generated and email initiated for session ${sessionId}`);
    } catch (err: any) {
      logger.error(`Error generating/sending report for session ${sessionId}:`, err);
    }

    return res.json({ success: true, message: 'Exam submitted successfully' });

  } catch (error) {
    next(error);
  }
};

export const sendExamReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId, sessionId } = req.params;
    const { email, violations } = req.body;

    const dbViolations = await awsService.getViolationsBySessionId(sessionId).catch(() => []);
    const filteredDbViolations = dbViolations.filter((v: any) => v.violationType && v.violationType !== 'SESSION_STARTED');
    const sourceViolations = filteredDbViolations.length > 0
      ? filteredDbViolations.map((v: any) => ({
          type: v.violationType || 'unknown',
          timestamp: v.timestamp || new Date().toISOString(),
          evidence: v.evidenceKey,
          metadata: v.metadata,
        }))
      : (violations || []);

    const violationsWithEvidence = await Promise.all(
      sourceViolations.map(async (v: any) => {
        const evidenceKey = normalizeEvidenceKey(v.evidence);
        let evidenceImage: Buffer | undefined;
        if (evidenceKey) {
          try {
            evidenceImage = await awsService.getEvidenceObjectBytes(evidenceKey);
          } catch (err) {
            logger.warn(`Unable to fetch evidence image for report: ${evidenceKey}`);
          }
        }

        return {
          type: v.type,
          timestamp: v.timestamp,
          evidence: evidenceKey || v.evidence,
          metadata: v.metadata,
          evidenceImage,
        };
      })
    );

    // Create the PDF buffer
    const pdfBuffer = await generatePdfReport({
      examId,
      sessionId,
      studentEmail: email,
      violations: violationsWithEvidence,
    });

    // Send the email with the PDF attached
    const adminEmail = process.env.ADMIN_EMAIL || config.aws.sesSourceEmail || email;
    try {
      await awsService.sendPdfReportEmail(
        adminEmail,
        pdfBuffer,
        `Exam Report - ${examId} - ${email}`,
        `Please find attached the proctoring report for session ${sessionId}.`
      );
    } catch (err: any) {
      const isSandboxReject =
        err?.name === 'MessageRejected' ||
        err?.Code === 'MessageRejected' ||
        (typeof err?.message === 'string' && err.message.includes('Email address is not verified'));

      if (isSandboxReject && config.env === 'development') {
        logger.warn('SES sandbox blocked PDF recipient. Continuing in development mode.');
        return res.json({
          success: true,
          message: 'Report generated locally. Email skipped due to SES sandbox recipient restrictions.',
          emailSent: false,
        });
      }
      throw err;
    }

    res.json({ success: true, message: 'PDF Report sent successfully', emailSent: true });
  } catch (error) {
    next(error);
  }
};

export const createLivenessSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = await awsService.createFaceLivenessSession();
    res.json({ success: true, sessionId });
  } catch (error: any) {
    logger.error(`[createLivenessSession] AWS error: [${error?.name}] ${error?.message}`);
    // Return a descriptive error so the frontend can show a meaningful message
    res.status(500).json({
      success: false,
      message: `Liveness session creation failed: ${error?.name || 'Unknown'} - ${error?.message || 'Check server logs'}`,
    });
  }
};

export const getLivenessResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const confidence = await awsService.getFaceLivenessSessionResult(sessionId);
    if (confidence !== undefined && confidence > 90) {
      res.json({ success: true, passed: true, confidence });
    } else {
      res.json({ success: true, passed: false, confidence });
    }
  } catch (error) {
    next(error);
  }
};

export const generatePairingLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const { email, sendEmail } = req.body;
    
    // Ensure the token from the user has the same examId
    const userSession = req.user;
    if (userSession?.examId !== examId) {
       return res.status(403).json({ success: false, message: 'Exam ID mismatch with session' });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Student email is required' });
    }

    // Create an ephemeral JWT with 5 min TTL
    const pairingToken = generateToken(
      { 
        userId: userSession.userId, 
        examId: userSession.examId, 
        sessionId: userSession.sessionId, 
        role: 'secondary_camera' 
      },
      '5m'
    );

    const magicLink = `myapp://pair?token=${pairingToken}`;

    const shouldSendEmail = sendEmail !== false;

    if (shouldSendEmail) {
      try {
        await awsService.sendMagicLinkEmail(email, magicLink);
      } catch (err: any) {
        const isSesDenied =
          err?.name === 'AccessDenied' ||
          err?.Code === 'AccessDenied' ||
          (typeof err?.message === 'string' && err.message.includes('ses:SendEmail'));

        if (isSesDenied && config.env === 'development') {
          logger.warn('SES send denied in development. Returning pairing token without email dispatch.');
          return res.json({
            success: true,
            message: 'SES not permitted in development. Pairing token generated without email.',
            emailSent: false,
            pairingToken,
            magicLink,
          });
        }

        throw err;
      }
    }

    res.json({
      success: true,
      message: shouldSendEmail ? 'Pairing magic link sent successfully' : 'Pairing token generated',
      emailSent: shouldSendEmail,
      pairingToken,
      magicLink,
    });
  } catch (error) {
    next(error);
  }
};

export const getExamById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await awsService.getExam(req.params.examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    res.json({ success: true, data: exam });
  } catch (error) {
    next(error);
  }
};

export const deleteExamById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await awsService.deleteExam(req.params.examId);
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    next(error);
  }
};
