// src/utils/cookieHelper.ts
// ─── HttpOnly Cookie for Refresh Token ────────────────────────────────────────
// Storing the refresh token in an HttpOnly cookie prevents XSS attacks.
// The access token is returned in the JSON body and stored in memory by clients.
import { Request, Response } from 'express';
import { env } from '../config/env';

const COOKIE_NAME = 'refreshToken';

// Parse "7d" → milliseconds
const parseExpiryMs = (expiry: string): number => {
  const unit = expiry.slice(-1);
  const val = parseInt(expiry.slice(0, -1), 10);
  const map: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * (map[unit] || 1000);
};

export const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,                          // Not accessible via JS — prevents XSS
    secure: env.cookie.secure,              // HTTPS only in production
    sameSite: 'strict',                      // Prevents CSRF
    maxAge: parseExpiryMs(env.jwt.refreshExpiresIn),
    path: '/api/v1/auth',                   // Only sent to auth routes
  });
};

export const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
};

export const getRefreshTokenFromRequest = (req: Request): string | undefined => {
  // First check HttpOnly cookie (browser clients)
  // Fallback to body for API clients (Postman, mobile)
  return req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
};
