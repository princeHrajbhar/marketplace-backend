// src/utils/otp.ts
import crypto from 'crypto';

/**
 * Generates a cryptographically secure 6-digit OTP.
 * Uses crypto.randomBytes to avoid Math.random() bias.
 */
export const generateOtp = (): string => {
  const buffer = crypto.randomBytes(3);
  const num = (parseInt(buffer.toString('hex'), 16) % 900000) + 100000;
  return num.toString();
};

/**
 * Generates a secure 64-char hex token for password reset links.
 */
export const generateResetToken = (): string =>
  crypto.randomBytes(32).toString('hex');

/**
 * Generates a UUID-like string for refresh token IDs.
 * Each token is uniquely identified in the DB for per-device revocation.
 */
export const generateTokenId = (): string =>
  crypto.randomUUID();
