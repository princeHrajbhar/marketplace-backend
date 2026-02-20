// src/services/authService.ts
import mongoose from 'mongoose';
import { User, IUser } from '../models/User';
import { OtpService } from './otpService';
import { TokenService } from './tokenService';
import { EmailService } from './emailService';
import { publishEmailJob } from '../queues/producer';
import { verifyGoogleIdToken } from '../config/google';
import { generateResetToken } from '../utils/otp';
import { OtpPurpose, UserRole, TokenPair, EmailJobType } from '../types';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const otpService = new OtpService();
const tokenService = new TokenService();
const emailService = new EmailService();

interface ClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface AuthResult {
  user: Record<string, unknown>;
  tokens: TokenPair;
}

export class AuthService {
  // ── Register ──────────────────────────────────────────────────────────────────

  async register(input: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<{ userId: string; email: string }> {
    const { name, email, password, role = UserRole.USER } = input;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (!existing.isVerified) {
        // Re-send OTP for unverified accounts
        await otpService.createAndSend(
          existing._id,
          existing.email,
          existing.name,
          OtpPurpose.EMAIL_VERIFICATION
        );
        throw new Error(
          'Email already registered but not verified. A new OTP has been sent to your email.'
        );
      }
      throw new Error('Email is already registered');
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      isVerified: false,
      isActive: true,
    });

    await otpService.createAndSend(
      user._id,
      user.email,
      user.name,
      OtpPurpose.EMAIL_VERIFICATION
    );

    logger.info(`User registered: ${email} [${role}]`);
    return { userId: user._id.toString(), email: user.email };
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────────

  async verifyOtp(email: string, otp: string, meta?: ClientMeta): Promise<AuthResult> {
    const otpDoc = await otpService.verify(email, otp, OtpPurpose.EMAIL_VERIFICATION);

    const user = await User.findById(otpDoc.userId).select('+tokenVersion');
    if (!user) throw new Error('User not found');
    if (user.isVerified) throw new Error('Email is already verified');

    user.isVerified = true;
    await user.save({ validateBeforeSave: false });

    // Send welcome email
    const published = await publishEmailJob({
      type: EmailJobType.WELCOME,
      to: user.email,
      data: { name: user.name },
    });
    if (!published) await emailService.sendWelcomeEmail(user.email, user.name);

    const tokens = await tokenService.issueTokenPair(
      user._id,
      user.email,
      user.role,
      user.tokenVersion,
      meta
    );

    logger.info(`Email verified and logged in: ${email}`);
    return { user: user.toSafeObject(), tokens };
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────────

  async resendOtp(
    email: string
  ): Promise<{ resendAllowedAt: Date; expiresAt: Date }> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw new Error('Email not registered');
    if (user.isVerified) throw new Error('Email is already verified');
    if (!user.isActive) throw new Error('Account is deactivated');

    return otpService.resend(
      user._id,
      user.email,
      user.name,
      OtpPurpose.EMAIL_VERIFICATION
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────────

  async login(email: string, password: string, meta?: ClientMeta): Promise<AuthResult> {
    const user = await User.findByEmail(email);
    if (!user) throw new Error('Invalid email or password');
    if (!user.isActive) throw new Error('Account is deactivated. Please contact support.');
    if (!user.isVerified) {
      throw new Error(
        'Email not verified. Please verify your email before logging in.'
      );
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) throw new Error('Invalid email or password');

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const tokens = await tokenService.issueTokenPair(
      user._id,
      user.email,
      user.role,
      user.tokenVersion,
      meta
    );

    logger.info(`User logged in: ${email}`);
    return { user: user.toSafeObject(), tokens };
  }

  // ── Admin Login ───────────────────────────────────────────────────────────────

  async adminLogin(email: string, password: string, meta?: ClientMeta): Promise<AuthResult> {
    const user = await User.findByEmail(email);
    if (!user || user.role !== UserRole.ADMIN) {
      throw new Error('Invalid credentials or not an admin account');
    }
    if (!user.isActive) throw new Error('Account is deactivated');

    const isValid = await user.comparePassword(password);
    if (!isValid) throw new Error('Invalid credentials or not an admin account');

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const tokens = await tokenService.issueTokenPair(
      user._id,
      user.email,
      user.role,
      user.tokenVersion,
      meta
    );

    logger.info(`Admin logged in: ${email}`);
    return { user: user.toSafeObject(), tokens };
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────────

  async googleLogin(idToken: string, meta?: ClientMeta): Promise<AuthResult & { isNew: boolean }> {
    const payload = await verifyGoogleIdToken(idToken);
    const { email, name, sub: googleId, picture } = payload;

    let user = await User.findOne({
      $or: [{ googleId }, { email: email!.toLowerCase() }],
    }).select('+tokenVersion');

    let isNew = false;

    if (!user) {
      user = await User.create({
        name: name || email!.split('@')[0],
        email: email!.toLowerCase(),
        googleId,
        profilePicture: picture,
        isVerified: true, // Google-verified emails are trusted
        isActive: true,
        role: UserRole.USER,
      });
      // Reload with tokenVersion
      user = (await User.findById(user._id).select('+tokenVersion'))!;
      isNew = true;

      const published = await publishEmailJob({
        type: EmailJobType.WELCOME,
        to: email!,
        data: { name: user.name },
      });
      if (!published) await emailService.sendWelcomeEmail(email!, user.name);
    } else {
      if (!user.isActive) throw new Error('Account is deactivated');
      if (!user.googleId) {
        user.googleId = googleId;
        user.isVerified = true;
        if (picture && !user.profilePicture) user.profilePicture = picture;
        await user.save({ validateBeforeSave: false });
      }
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const tokens = await tokenService.issueTokenPair(
      user._id,
      user.email,
      user.role,
      user.tokenVersion,
      meta
    );

    logger.info(`Google login: ${email} [${isNew ? 'new' : 'existing'}]`);
    return { user: user.toSafeObject(), tokens, isNew };
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────────

  async refreshTokens(rawRefreshToken: string, meta?: ClientMeta): Promise<TokenPair> {
    return tokenService.rotateRefreshToken(rawRefreshToken, meta);
  }

  // ── Logout (current device) ───────────────────────────────────────────────────

  async logout(rawRefreshToken: string): Promise<void> {
    await tokenService.revokeRefreshToken(rawRefreshToken);
    logger.debug('Logout: token revoked');
  }

  // ── Logout All Devices ────────────────────────────────────────────────────────

  async logoutAll(userId: string): Promise<void> {
    const objectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(objectId);
    if (user) {
      // Increment tokenVersion — invalidates ALL existing access tokens
      await user.incrementTokenVersion();
      // Revoke all refresh tokens
      await tokenService.revokeAllTokensForUser(objectId);
      logger.info(`Logout all: userId=${userId}`);
    }
  }

  // ── Forgot Password ───────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase() });
    // Always succeed to prevent email enumeration
    if (!user || !user.isActive) return;

    const resetToken = generateResetToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = expiry;
    await user.save({ validateBeforeSave: false });

    const resetLink = `${env.server.frontendUrl}/reset-password?token=${resetToken}`;

    const published = await publishEmailJob({
      type: EmailJobType.FORGOT_PASSWORD,
      to: email,
      data: { resetLink, name: user.name },
    });
    if (!published) await emailService.sendForgotPasswordEmail(email, resetLink, user.name);
  }

  // ── Reset Password ────────────────────────────────────────────────────────────

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpiry: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpiry +tokenVersion');

    if (!user) throw new Error('Invalid or expired reset token');

    user.password = newPassword; // Pre-save hook hashes + bumps tokenVersion
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    // Revoke all refresh tokens — forces re-login everywhere
    await tokenService.revokeAllTokensForUser(user._id);

    // Notify user
    const published = await publishEmailJob({
      type: EmailJobType.PASSWORD_CHANGED,
      to: user.email,
      data: { name: user.name },
    });
    if (!published) await emailService.sendPasswordChangedEmail(user.email, user.name);

    logger.info(`Password reset: ${user.email}`);
  }

  // ── Get Active Sessions ───────────────────────────────────────────────────────

  async getActiveSessions(userId: string) {
    return tokenService.getActiveSessions(new mongoose.Types.ObjectId(userId));
  }
}
