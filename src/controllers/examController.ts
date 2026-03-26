import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../utils/jwt';
import { awsService } from '../services/awsService';

import { logger } from '../logger';

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

    const hasPhone = labelsRes.Labels?.some(l => l.Name === 'Phone' || l.Name === 'Cell Phone' || l.Name === 'Mobile Phone');
    const multipleFaces = (facesRes.FaceDetails?.length || 0) > 1;

    if (hasPhone || multipleFaces) {
      const violationType = hasPhone ? 'PHONE_DETECTED' : 'MULTIPLE_PERSONS_DETECTED';
      const timestamp = new Date().toISOString();
      await awsService.logViolationEvent(userSession.sessionId, timestamp, violationType, s3Key);

      // Send SES email to admin
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@institution.edu';
      const emailBody = `A critical violation was detected in session ${userSession.sessionId}.\nViolation Type: ${violationType}\nTimestamp: ${timestamp}\nEvidence: s3://${process.env.AWS_S3_BUCKET}/${s3Key}`;
      await awsService.sendMagicLinkEmail(adminEmail, emailBody).catch(e => {
        logger.error('Failed to send admin notification email', e);
      });

      logger.warn(`Violation detected for session ${userSession.sessionId}: ${violationType}`);
      res.json({ success: true, violationDetected: true, violationType });
    } else {
      res.json({ success: true, violationDetected: false });
    }
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
    const { email } = req.body;
    
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

    // Send email via AWS SES
    await awsService.sendMagicLinkEmail(email, magicLink);

    res.json({
      success: true,
      message: 'Pairing magic link sent successfully',
    });
  } catch (error) {
    next(error);
  }
};
