/**
 * Authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config.js';
import { userDb } from '../db.js';

export interface JwtPayload {
  userId: string;
  deviceId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      deviceId?: string;
    }
  }
}

/**
 * Require valid JWT authentication
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const config = getConfig();
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = userDb.findById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
    };
    req.deviceId = payload.deviceId;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Generate a JWT for a user
 */
export function generateToken(payload: JwtPayload): string {
  const config = getConfig();
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Generate a random state for OAuth
 */
export function generateOAuthState(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    'base64url'
  );
}
