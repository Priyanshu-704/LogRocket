import jwt from 'jsonwebtoken';
import config from '../config';

export interface UserTokenPayload {
  userId: string;
  role: string;
}

export function generateToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any
  });
}

export function verifyToken(token: string): UserTokenPayload {
  return jwt.verify(token, config.jwtSecret) as UserTokenPayload;
}
