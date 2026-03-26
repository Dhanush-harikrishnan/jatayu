import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../utils/jwt';
import { v4 as uuidv4 } from 'uuid';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, examId } = req.body;

    if (!userId || !examId) {
      return res.status(400).json({ success: false, message: 'userId and examId are required' });
    }

    // Generate a unique session ID for this exam attempt
    const sessionId = uuidv4();

    const token = generateToken(
      { userId, examId, role: 'primary', sessionId },
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
