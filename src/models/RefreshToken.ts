// src/models/RefreshToken.ts
// ─── Refresh Token Store ──────────────────────────────────────────────────────
// Each issued refresh token is stored as a hashed record.
// This enables:
//   - Per-device logout (revoke one tokenId)
//   - Logout-all-devices (revoke all for userId)
//   - Token reuse detection (if revoked token used → security alert)
//   - Automatic cleanup via MongoDB TTL index
import mongoose, { Document, Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface IRefreshToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tokenId: string;       // UUID — stored in JWT payload, used to find DB record
  hashedToken: string;   // SHA-256 hash of the raw refresh token
  tokenVersion: number;  // Snapshot of user.tokenVersion at time of issue
  isRevoked: boolean;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
}

export interface IRefreshTokenModel extends Model<IRefreshToken> {
  findByTokenId(tokenId: string): Promise<IRefreshToken | null>;
  revokeByTokenId(tokenId: string): Promise<void>;
  revokeAllForUser(userId: mongoose.Types.ObjectId): Promise<void>;
  hashToken(rawToken: string): string;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    hashedToken: {
      type: String,
      required: true,
    },
    tokenVersion: {
      type: Number,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    userAgent: String,
    ipAddress: String,
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes expired refresh tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Static Methods ───────────────────────────────────────────────────────────

refreshTokenSchema.statics.hashToken = (rawToken: string): string =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

refreshTokenSchema.statics.findByTokenId = function (
  tokenId: string
): Promise<IRefreshToken | null> {
  return this.findOne({ tokenId, isRevoked: false, expiresAt: { $gt: new Date() } });
};

refreshTokenSchema.statics.revokeByTokenId = async function (tokenId: string): Promise<void> {
  await this.updateOne({ tokenId }, { $set: { isRevoked: true } });
};

refreshTokenSchema.statics.revokeAllForUser = async function (
  userId: mongoose.Types.ObjectId
): Promise<void> {
  await this.updateMany(
    { userId, isRevoked: false },
    { $set: { isRevoked: true } }
  );
};

export const RefreshToken = mongoose.model<IRefreshToken, IRefreshTokenModel>(
  'RefreshToken',
  refreshTokenSchema
);
