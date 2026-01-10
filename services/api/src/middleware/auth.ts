/**
 * Authentication Middleware
 * Verifies Firebase ID tokens and attaches user info to request
 */

import { Request, Response, NextFunction } from 'express';
import { auth } from '../services/firebase';
import { DecodedIdToken } from 'firebase-admin/auth';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
      userId?: string;
    }
  }
}

/**
 * Middleware to verify Firebase ID token
 * Extracts token from Authorization header: "Bearer <token>"
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    req.userId = decodedToken.uid;
    next();
  } catch (error: any) {
    console.error('Token verification failed:', error.code);

    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({
        success: false,
        error: 'TokenExpired',
        message: 'Token has expired. Please sign in again.',
      });
    } else if (error.code === 'auth/id-token-revoked') {
      res.status(401).json({
        success: false,
        error: 'TokenRevoked',
        message: 'Token has been revoked. Please sign in again.',
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'InvalidToken',
        message: 'Invalid authentication token',
      });
    }
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that work with or without auth
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    req.userId = decodedToken.uid;
  } catch (error) {
    // Ignore errors for optional auth
    console.warn('Optional auth token verification failed');
  }

  next();
}
