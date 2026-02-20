// src/middlewares/rateLimiter.ts
import rateLimit from 'express-rate-limit';

const jsonMessage = (message: string) => ({ success: false, message });

/** General API limiter: 200 req / 15 min */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many requests. Please slow down.'),
});

/** Auth endpoints: 15 req / 15 min */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many authentication attempts. Please try again in 15 minutes.'),
});

/** OTP endpoints: 5 req / 1 hour */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many OTP requests. Please try again in 1 hour.'),
});

/** Refresh token endpoint: 30 req / 15 min */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many token refresh requests.'),
});
