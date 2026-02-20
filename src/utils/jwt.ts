// src/utils/jwt.ts
// ─── Access Token + Refresh Token (Rotation Strategy) ────────────────────────
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
  TokenType,
  UserRole,
} from '../types';

// ── Access Token ──────────────────────────────────────────────────────────────

export const generateAccessToken = (
  userId: string,
  email: string,
  role: UserRole,
  tokenVersion: number
): string => {
  const payload: AccessTokenPayload = {
    userId,
    email,
    role,
    tokenVersion,
    type: TokenType.ACCESS,
  };

  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
    issuer: 'marketplace-api',
    audience: 'marketplace-client',
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.jwt.accessSecret, {
    issuer: 'marketplace-api',
    audience: 'marketplace-client',
  }) as AccessTokenPayload;

  if (decoded.type !== TokenType.ACCESS) {
    throw new Error('Invalid token type');
  }

  return decoded;
};

// ── Refresh Token ─────────────────────────────────────────────────────────────

export const generateRefreshToken = (
  userId: string,
  tokenId: string,
  tokenVersion: number
): string => {
  const payload: RefreshTokenPayload = {
    userId,
    tokenId,
    tokenVersion,
    type: TokenType.REFRESH,
  };

  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
    issuer: 'marketplace-api',
    audience: 'marketplace-client',
  } as jwt.SignOptions);
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, env.jwt.refreshSecret, {
    issuer: 'marketplace-api',
    audience: 'marketplace-client',
  }) as RefreshTokenPayload;

  if (decoded.type !== TokenType.REFRESH) {
    throw new Error('Invalid token type');
  }

  return decoded;
};

// ── Token Pair ────────────────────────────────────────────────────────────────

export const generateTokenPair = (
  userId: string,
  email: string,
  role: UserRole,
  tokenVersion: number,
  tokenId: string
): TokenPair => ({
  accessToken: generateAccessToken(userId, email, role, tokenVersion),
  refreshToken: generateRefreshToken(userId, tokenId, tokenVersion),
  accessTokenExpiresIn: env.jwt.accessExpiresIn,
  refreshTokenExpiresIn: env.jwt.refreshExpiresIn,
});
