// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/User';
import { sendUnauthorized } from '../utils/apiResponse';
import { logger } from '../utils/logger';

/**
 * Authenticates requests using JWT access token in Authorization header.
 * Format: Authorization: Bearer <accessToken>
 *
 * Also verifies:
 *   - User still exists and is active
 *   - tokenVersion matches (catches password change / logout-all)
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      sendUnauthorized(res, 'Access token required. Use: Authorization: Bearer <token>');
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      sendUnauthorized(res, 'Access token is empty');
      return;
    }

    const decoded = verifyAccessToken(token);

    // Check user still exists, active, and tokenVersion matches
    const user = await User.findById(decoded.userId).select('isActive tokenVersion');
    if (!user) {
      sendUnauthorized(res, 'User not found');
      return;
    }
    if (!user.isActive) {
      sendUnauthorized(res, 'Account is deactivated');
      return;
    }

    // tokenVersion mismatch means password was changed or logout-all was called
    if (decoded.tokenVersion !== (user as any).tokenVersion) {
      sendUnauthorized(
        res,
        'Session expired — your password was changed or you were logged out from all devices. Please log in again.'
      );
      return;
    }

    req.user = decoded;
    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        sendUnauthorized(
          res,
          'Access token expired. Use POST /auth/refresh-token to get a new one.'
        );
        return;
      }
      if (error.name === 'JsonWebTokenError') {
        sendUnauthorized(res, 'Invalid access token');
        return;
      }
      if (error.name === 'NotBeforeError') {
        sendUnauthorized(res, 'Token not yet valid');
        return;
      }
    }
    logger.error('Auth middleware error:', error);
    sendUnauthorized(res, 'Authentication failed');
  }
};

/**
 * Optional authentication — attaches user if token present, continues either way.
 * Useful for endpoints that behave differently for logged-in users.
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      req.user = verifyAccessToken(token);
    }
  } catch {
    // Ignore — optional auth
  }
  next();
};
