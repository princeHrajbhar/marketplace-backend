// src/models/Otp.ts
import mongoose, { Document, Schema, Model } from 'mongoose';
import { OtpPurpose } from '../types';
import { env } from '../config/env';

export interface IOtp extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  email: string;
  otp: string;           // Stored as plain (hash if needed for high security apps)
  purpose: OtpPurpose;
  expiresAt: Date;
  resendAllowedAt: Date;
  attempts: number;
  isUsed: boolean;
  createdAt: Date;
  // Methods
  isExpired(): boolean;
  isResendAllowed(): boolean;
  hasExceededAttempts(): boolean;
}

export interface IOtpModel extends Model<IOtp> {
  findLatestValid(email: string, purpose: OtpPurpose): Promise<IOtp | null>;
  invalidateAllForUser(userId: mongoose.Types.ObjectId, purpose: OtpPurpose): Promise<void>;
  getResendStatus(userId: mongoose.Types.ObjectId, purpose: OtpPurpose): Promise<IOtp | null>;
}

const otpSchema = new Schema<IOtp>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
      select: false,  // Never returned in normal queries
    },
    purpose: {
      type: String,
      enum: Object.values(OtpPurpose),
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    resendAllowedAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-delete OTPs 1 hour after expiry
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
otpSchema.index({ userId: 1, purpose: 1 });
otpSchema.index({ email: 1, purpose: 1 });

// ─── Instance Methods ─────────────────────────────────────────────────────────

otpSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt;
};

otpSchema.methods.isResendAllowed = function (): boolean {
  return new Date() >= this.resendAllowedAt;
};

otpSchema.methods.hasExceededAttempts = function (): boolean {
  return this.attempts >= env.otp.maxAttempts;
};

// ─── Static Methods ───────────────────────────────────────────────────────────

otpSchema.statics.findLatestValid = function (
  email: string,
  purpose: OtpPurpose
): Promise<IOtp | null> {
  return this.findOne({
    email: email.toLowerCase(),
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  })
    .select('+otp')
    .sort({ createdAt: -1 });
};

otpSchema.statics.invalidateAllForUser = async function (
  userId: mongoose.Types.ObjectId,
  purpose: OtpPurpose
): Promise<void> {
  await this.updateMany(
    { userId, purpose, isUsed: false },
    { $set: { isUsed: true } }
  );
};

otpSchema.statics.getResendStatus = function (
  userId: mongoose.Types.ObjectId,
  purpose: OtpPurpose
): Promise<IOtp | null> {
  return this.findOne({ userId, purpose, isUsed: false }).sort({ createdAt: -1 });
};

export const Otp = mongoose.model<IOtp, IOtpModel>('Otp', otpSchema);
