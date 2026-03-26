import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../utils/jwt';
import { awsService } from '../services/awsService';

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
