import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../utils/jwt';
import { v4 as uuidv4 } from 'uuid';
import { awsService } from '../services/awsService';
import bcrypt from 'bcryptjs';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // We accept userId/email and password. examId is optional (used for students).
    const email = req.body.email || req.body.userId; // fallback since frontend used userId
    const { password, examId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await awsService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash || '');
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate a unique session ID for this exam attempt (or admin session)
    const sessionId = uuidv4();
    const normalizeRole = (role: any) => {
      // DynamoDB user roles are `admin` and `student`.
      // Backend route authorization expects `admin` and `primary`.
      if (role === 'student') return 'primary';
      if (role === 'admin') return 'admin';
      if (role === 'primary' || role === 'secondary_camera') return role;
      return role;
    };

    const tokenPayload: any = { 
      userId: user.email, 
      role: normalizeRole(user.role), 
      name: user.name, 
      sessionId 
    };

    if (examId) {
      tokenPayload.examId = examId;
    }

    if (user.role === 'admin') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      console.log(`\n======================================`);
      console.log(`🔑 ADMIN LOGIN OTP: ${otp}`);
      console.log(`======================================\n`);

      await awsService.saveUserOTP(user.email!, otp, expiry);
      await awsService.sendOTPEmail(user.email!, otp);
      return res.json({
        success: true,
        data: {
          requires2FA: true,
          email: user.email
        }
      });
    }

    const token = generateToken(tokenPayload, '4h');

    res.json({
      success: true,
      data: {
        token,
        sessionId,
        role: normalizeRole(user.role),
        name: user.name
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verify2FA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await awsService.getUserByEmail(email);

    if (!user || user.otp !== otp || new Date() > new Date(user.otpExpiry!)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired verification code' });
    }

    // clear OTP
    await awsService.clearUserOTP(email);

    const sessionId = uuidv4();
    const normalizeRole = (role: any) => {
      if (role === 'student') return 'primary';
      if (role === 'admin') return 'admin';
      if (role === 'primary' || role === 'secondary_camera') return role;
      return role;
    };

    const tokenPayload: any = { 
      userId: user.email, 
      role: normalizeRole(user.role), 
      name: user.name, 
      sessionId 
    };
    const token = generateToken(tokenPayload, '4h');

    res.json({
      success: true,
      data: {
        token,
        sessionId,
        role: normalizeRole(user.role),
        name: user.name
      }
    });
  } catch (error) {
    next(error);
  }
};
