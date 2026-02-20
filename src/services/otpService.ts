// src/services/otpService.ts
import mongoose from 'mongoose';
import { Otp, IOtp } from '../models/Otp';
import { OtpPurpose, EmailJobType } from '../types';
import { generateOtp } from '../utils/otp';
import { publishEmailJob } from '../queues/producer';
import { EmailService } from './emailService';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const emailService = new EmailService();

export class OtpService {
  // ── Create and Send OTP ───────────────────────────────────────────────────────

  async createAndSend(
    userId: mongoose.Types.ObjectId,
    email: string,
    name: string,
    purpose: OtpPurpose
  ): Promise<void> {
    // Invalidate all existing OTPs for this user + purpose
    await Otp.invalidateAllForUser(userId, purpose);

    const rawOtp = generateOtp();
    const now = new Date();

    await Otp.create({
      userId,
      email: email.toLowerCase(),
      otp: rawOtp,
      purpose,
      expiresAt: new Date(now.getTime() + env.otp.expiresMinutes * 60 * 1000),
      resendAllowedAt: new Date(now.getTime() + env.otp.resendCooldownSeconds * 1000),
    });

    // Determine job type based on purpose
    const jobType =
      purpose === OtpPurpose.FORGOT_PASSWORD
        ? EmailJobType.FORGOT_PASSWORD
        : EmailJobType.OTP_VERIFICATION;

    const published = await publishEmailJob({
      type: jobType,
      to: email,
      data: { otp: rawOtp, name, purpose },
    });

    if (!published) {
      // Fallback: send directly
      if (purpose === OtpPurpose.FORGOT_PASSWORD) {
        // For forgot password, we send reset link not OTP directly
        // But OTP is embedded in this flow for this implementation
        await emailService.sendOtpEmail(email, rawOtp, name);
      } else {
        await emailService.sendOtpEmail(email, rawOtp, name);
      }
    }

    logger.info(`OTP created and sent: purpose=${purpose} email=${email}`);
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────────

  async verify(email: string, rawOtp: string, purpose: OtpPurpose): Promise<IOtp> {
    const otpDoc = await Otp.findLatestValid(email, purpose);

    if (!otpDoc) {
      throw new Error('OTP not found or has expired. Please request a new one.');
    }

    if (otpDoc.hasExceededAttempts()) {
      throw new Error(
        `Maximum attempts (${env.otp.maxAttempts}) reached. Please request a new OTP.`
      );
    }

    // Increment attempt counter before checking (prevents timing attacks on attempt limit)
    otpDoc.attempts += 1;
    await otpDoc.save();

    if (otpDoc.otp !== rawOtp) {
      const remaining = env.otp.maxAttempts - otpDoc.attempts;
      if (remaining <= 0) {
        throw new Error('Maximum attempts reached. Please request a new OTP.');
      }
      throw new Error(`Incorrect OTP. ${remaining} attempt(s) remaining.`);
    }

    // Mark as used
    otpDoc.isUsed = true;
    await otpDoc.save();

    return otpDoc;
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────────

  async resend(
    userId: mongoose.Types.ObjectId,
    email: string,
    name: string,
    purpose: OtpPurpose
  ): Promise<{ resendAllowedAt: Date; expiresAt: Date }> {
    // Check cooldown
    const existing = await Otp.getResendStatus(userId, purpose);

    if (existing && !existing.isExpired() && !existing.isResendAllowed()) {
      const secondsLeft = Math.ceil(
        (existing.resendAllowedAt.getTime() - Date.now()) / 1000
      );
      throw new Error(
        `Please wait ${secondsLeft} second(s) before requesting a new OTP.`
      );
    }

    await this.createAndSend(userId, email, name, purpose);

    // Return timing info for the client
    const newOtp = await Otp.getResendStatus(userId, purpose);
    return {
      resendAllowedAt: newOtp!.resendAllowedAt,
      expiresAt: newOtp!.expiresAt,
    };
  }
}
