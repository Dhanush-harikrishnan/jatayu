import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../utils/jwt';
import { v4 as uuidv4 } from 'uuid';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, password, examId } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ success: false, message: 'userId and password are required' });
    }

    // Check Admin Credentials
    if (userId === 'dhanushhari150504@gmail.com' || userId === 'dhanushhari150504@gmail') {
      if (password === 'Dhanush@1505') {
        const sessionId = uuidv4();
        const token = generateToken(
          { userId, role: 'admin', sessionId },
          '12h'
        );
        return res.json({
          success: true,
          data: { token, sessionId },
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
      }
    }

    // Check Student Credentials
    if (userId === 'barathsyntax@gmail.com') {
      if (password === 'Barath@1505') {
        if (!examId) {
          return res.status(400).json({ success: false, message: 'examId is required for student' });
        }
        const sessionId = uuidv4();
        const token = generateToken(
          { userId, examId, role: 'primary', sessionId },
          '4h' // Exam duration constraint
        );
        return res.json({
          success: true,
          data: { token, sessionId },
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid student credentials' });
      }
    }

    return res.status(401).json({ success: false, message: 'User not found or invalid credentials' });
  } catch (error) {
    next(error);
  }
};
