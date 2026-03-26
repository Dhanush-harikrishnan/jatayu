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

    const [labelsRes, facesRes] = await Promise.all([
      awsService.detectLabelsFromS3(s3Key),
      awsService.detectFacesFromS3(s3Key)
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
    const s3Key = `exams/${examId}/${userSession.sessionId}/${Date.now()}_setup-frame.jpg`;

    // Upload via backend to avoid browser S3 CORS requirements during local development.
    await awsService.uploadEvidenceToS3(s3Key, imageBase64);

    const [labelsRes, facesRes] = await Promise.all([
      awsService.detectLabels(buffer),
      awsService.detectFaces(buffer),
    ]);

    const hasPhone = labelsRes.Labels?.some(l =>
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

    return res.json({
      success: true,
      violationDetected: false,
      s3Key,
      faceCount,
      faceDetected,
    });
  } catch (error) {
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
    const s3Key = `exams/${examId}/${userSession.sessionId}/${Date.now()}_live-frame.jpg`;

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

import { generatePdfReport } from '../services/pdfService';

export const sendExamReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId, sessionId } = req.params;
    const { email, violations } = req.body;

    const dbViolations = await awsService.getViolationsBySessionId(sessionId).catch(() => []);
    const sourceViolations = dbViolations.length > 0
      ? dbViolations.map((v: any) => ({
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
  } catch (error) {
    next(error);
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
