// src/services/tokenService.ts
// ─── Token Lifecycle: Issue · Rotate · Revoke ─────────────────────────────────
//
// STRATEGY:
//   Access Token  → Short-lived (15m), stateless JWT, verified via tokenVersion
//   Refresh Token → Long-lived (7d), stored hashed in DB, rotated on every use
//
// TOKEN ROTATION:
//   Each /auth/refresh call:
//     1. Verify refresh token JWT
//     2. Look up tokenId in DB → must exist and not be revoked
//     3. Compare tokenVersion in token vs user.tokenVersion
//     4. Revoke the OLD token (rotation)
//     5. Issue NEW token pair
//     6. Store new refresh token hash in DB
//
// REUSE DETECTION:
//   If a revoked tokenId is presented → attacker may have stolen a token.
//   Response: revoke ALL refresh tokens for that user and force re-login.
//
import mongoose from 'mongoose';
import crypto from 'crypto';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { generateTokenId } from '../utils/otp';
import { TokenPair, UserRole } from '../types';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const parseDurationMs = (expiry: string): number => {
  const unit = expiry.slice(-1);
  const val = parseInt(expiry.slice(0, -1), 10);
  const map: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * (map[unit] ?? 1000);
};

export class TokenService {
  // ── Issue Token Pair ──────────────────────────────────────────────────────────

  async issueTokenPair(
    userId: mongoose.Types.ObjectId,
    email: string,
    role: UserRole,
    tokenVersion: number,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<TokenPair> {
    const tokenId = generateTokenId();

    const tokens = generateTokenPair(
      userId.toString(),
      email,
      role,
      tokenVersion,
      tokenId
    );

    // Store hashed refresh token
    const hashedToken = RefreshToken.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + parseDurationMs(env.jwt.refreshExpiresIn));

    await RefreshToken.create({
      userId,
      tokenId,
      hashedToken,
      tokenVersion,
      isRevoked: false,
      expiresAt,
      userAgent: meta?.userAgent?.slice(0, 200),
      ipAddress: meta?.ipAddress,
    });

    logger.debug(`Tokens issued for userId=${userId} tokenId=${tokenId}`);
    return tokens;
  }

  // ── Rotate Refresh Token ──────────────────────────────────────────────────────

  async rotateRefreshToken(
    rawRefreshToken: string,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<TokenPair> {
    // 1. Verify JWT signature + expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    const { userId, tokenId, tokenVersion } = decoded;

    // 2. Look up in DB
    const storedToken = await RefreshToken.findByTokenId(tokenId);

    if (!storedToken) {
      // Token not found — either expired or revoked
      // Check if it was a revoked token (potential reuse attack)
      const revokedToken = await RefreshToken.findOne({ tokenId });

      if (revokedToken?.isRevoked) {
        // ⚠️ Reuse detected — attacker may have stolen a token
        logger.warn(
          `🚨 REFRESH TOKEN REUSE DETECTED — userId=${userId} tokenId=${tokenId}. Revoking all tokens.`
        );
        await RefreshToken.revokeAllForUser(new mongoose.Types.ObjectId(userId));
        throw new Error(
          'Security alert: token reuse detected. All sessions have been logged out. Please log in again.'
        );
      }

      throw new Error('Refresh token not found or expired. Please log in again.');
    }

    // 3. Verify the raw token matches the hash in DB
    const expectedHash = RefreshToken.hashToken(rawRefreshToken);
    if (storedToken.hashedToken !== expectedHash) {
      throw new Error('Refresh token mismatch. Please log in again.');
    }

    // 4. Get fresh user data
    const user = await User.findById(userId).select('+tokenVersion');
    if (!user || !user.isActive) {
      throw new Error('User not found or account deactivated');
    }

    // 5. Validate tokenVersion — if user changed password or logged out all,
    //    the tokenVersion in DB won't match the user's current version
    if (tokenVersion !== user.tokenVersion) {
      logger.warn(`Token version mismatch for userId=${userId} — forcing re-login`);
      await RefreshToken.revokeByTokenId(tokenId);
      throw new Error('Session is no longer valid. Please log in again.');
    }

    // 6. Revoke the old token (rotate)
    await RefreshToken.revokeByTokenId(tokenId);

    // 7. Issue fresh token pair
    const newTokens = await this.issueTokenPair(
      user._id,
      user.email,
      user.role,
      user.tokenVersion,
      meta
    );

    logger.debug(`Token rotated for userId=${userId}`);
    return newTokens;
  }

  // ── Revoke Single Token (logout current device) ───────────────────────────────

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    try {
      const decoded = verifyRefreshToken(rawRefreshToken);
      await RefreshToken.revokeByTokenId(decoded.tokenId);
      logger.debug(`Token revoked: tokenId=${decoded.tokenId}`);
    } catch {
      // If token is invalid/expired, nothing to revoke
    }
  }

  // ── Revoke All Tokens (logout all devices) ────────────────────────────────────

  async revokeAllTokensForUser(userId: mongoose.Types.ObjectId): Promise<void> {
    await RefreshToken.revokeAllForUser(userId);
    logger.debug(`All tokens revoked for userId=${userId}`);
  }

  // ── List Active Sessions ──────────────────────────────────────────────────────

  async getActiveSessions(userId: mongoose.Types.ObjectId) {
    return RefreshToken.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .select('tokenId userAgent ipAddress createdAt expiresAt')
      .sort({ createdAt: -1 });
  }
}
