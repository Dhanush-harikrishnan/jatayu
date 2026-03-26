import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';

export interface TokenPayload {
  userId?: string;
  examId?: string;
  role: 'primary' | 'secondary_camera' | 'admin';
  sessionId: string;
}

export const generateToken = (payload: TokenPayload, expiresIn: string | number = '1h'): string => {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return jwt.sign(payload, config.jwtSecret, options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
};
