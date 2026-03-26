import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../utils/jwt';
import { v4 as uuidv4 } from 'uuid';
import { awsService } from '../services/awsService';
import bcrypt from 'bcrypt';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, examId, password, isAdmin } = req.body;

    if (!userId || !examId || !password) {
      return res.status(400).json({ success: false, message: 'userId, examId, and password are required' });
    }

    // Retrieve user from DB (mocked for demo purposes due to IAM permissions)
    const user = await awsService.getUserByEmail(userId);
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if the role matches
    if (isAdmin && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized as admin' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate a unique session ID for this exam attempt
    const sessionId = uuidv4();

    const token = generateToken(
      { userId, examId, role: isAdmin ? 'admin' : 'primary', sessionId },
      '4h' // Exam duration constraint
    );

    res.json({
      success: true,
      data: {
        token,
        sessionId,
      },
    });
  } catch (error) {
    next(error);
  }
};
