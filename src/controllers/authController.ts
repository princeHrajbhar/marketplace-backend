// src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendUnauthorized,
} from '../utils/apiResponse';
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
} from '../utils/cookieHelper';

const authService = new AuthService();

const clientMeta = (req: Request) => ({
  userAgent: req.headers['user-agent'],
  ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
});

export class AuthController {
  // ── POST /auth/register ────────────────────────────────────────────────────

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password, role } = req.body;
      const result = await authService.register({ name, email, password, role });
      sendCreated(
        res,
        'Registration successful! Please check your email for the OTP to verify your account.',
        result
      );
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('already registered') || msg.includes('not verified')) {
        sendError(res, msg, msg.includes('not verified') ? 400 : 409);
        return;
      }
      next(error);
    }
  }

  // ── POST /auth/verify-otp ──────────────────────────────────────────────────

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      const { user, tokens } = await authService.verifyOtp(email, otp, clientMeta(req));

      // Set refresh token in HttpOnly cookie
      setRefreshTokenCookie(res, tokens.refreshToken);

      sendSuccess(res, 'Email verified successfully! You are now logged in.', {
        user,
        accessToken: tokens.accessToken,
        accessTokenExpiresIn: tokens.accessTokenExpiresIn,
        // Note: refreshToken is set in HttpOnly cookie + returned for API clients
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      sendError(res, (error as Error).message, 400);
    }
  }

  // ── POST /auth/resend-otp ──────────────────────────────────────────────────

  async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.resendOtp(req.body.email);
      sendSuccess(res, 'OTP resent successfully. Check your email.', result);
    } catch (error) {
      const msg = (error as Error).message;
      sendError(res, msg, msg.includes('wait') ? 429 : 400);
    }
  }

  // ── POST /auth/login ───────────────────────────────────────────────────────

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const { user, tokens } = await authService.login(email, password, clientMeta(req));

      setRefreshTokenCookie(res, tokens.refreshToken);

      sendSuccess(res, 'Login successful', {
        user,
        accessToken: tokens.accessToken,
        accessTokenExpiresIn: tokens.accessTokenExpiresIn,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      const msg = (error as Error).message;
      const code = msg.includes('verified') ? 403 : 401;
      sendError(res, msg, code);
    }
  }

  // ── POST /auth/admin/login ─────────────────────────────────────────────────

  async adminLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const { user, tokens } = await authService.adminLogin(email, password, clientMeta(req));

      setRefreshTokenCookie(res, tokens.refreshToken);

      sendSuccess(res, 'Admin login successful', {
        user,
        accessToken: tokens.accessToken,
        accessTokenExpiresIn: tokens.accessTokenExpiresIn,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      sendError(res, (error as Error).message, 401);
    }
  }

  // ── POST /auth/google ──────────────────────────────────────────────────────

  async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken } = req.body;
      const { user, tokens, isNew } = await authService.googleLogin(idToken, clientMeta(req));

      setRefreshTokenCookie(res, tokens.refreshToken);

      const statusCode = isNew ? 201 : 200;
      res.status(statusCode).json({
        success: true,
        message: isNew ? 'Account created via Google' : 'Google login successful',
        data: {
          user,
          accessToken: tokens.accessToken,
          accessTokenExpiresIn: tokens.accessTokenExpiresIn,
          refreshToken: tokens.refreshToken,
          isNew,
        },
      });
    } catch (error) {
      sendError(res, (error as Error).message, 401);
    }
  }

  // ── POST /auth/refresh-token ───────────────────────────────────────────────

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = getRefreshTokenFromRequest(req);
      if (!rawRefreshToken) {
        sendUnauthorized(
          res,
          'Refresh token required. Pass in body as refreshToken or via HttpOnly cookie.'
        );
        return;
      }

      const tokens = await authService.refreshTokens(rawRefreshToken, clientMeta(req));

      // Rotate cookie too
      setRefreshTokenCookie(res, tokens.refreshToken);

      sendSuccess(res, 'Tokens refreshed successfully', {
        accessToken: tokens.accessToken,
        accessTokenExpiresIn: tokens.accessTokenExpiresIn,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      clearRefreshTokenCookie(res);
      sendUnauthorized(res, (error as Error).message);
    }
  }

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = getRefreshTokenFromRequest(req);
      if (rawRefreshToken) {
        await authService.logout(rawRefreshToken);
      }
      clearRefreshTokenCookie(res);
      sendSuccess(res, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  // ── POST /auth/logout-all ──────────────────────────────────────────────────

  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logoutAll(req.user!.userId);
      clearRefreshTokenCookie(res);
      sendSuccess(res, 'Logged out from all devices successfully');
    } catch (error) {
      next(error);
    }
  }

  // ── POST /auth/forgot-password ─────────────────────────────────────────────

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.forgotPassword(req.body.email);
      // Always return success to prevent email enumeration
      sendSuccess(
        res,
        'If an account with that email exists, a password reset link has been sent.'
      );
    } catch (error) {
      next(error);
    }
  }

  // ── POST /auth/reset-password ──────────────────────────────────────────────

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);
      clearRefreshTokenCookie(res);
      sendSuccess(
        res,
        'Password reset successfully. All active sessions have been logged out. Please log in again.'
      );
    } catch (error) {
      sendError(res, (error as Error).message, 400);
    }
  }

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await (await import('../models/User')).User.findById(
        req.user!.userId
      );
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }
      sendSuccess(res, 'Profile fetched', user.toSafeObject());
    } catch (error) {
      next(error);
    }
  }

  // ── GET /auth/sessions ─────────────────────────────────────────────────────

  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await authService.getActiveSessions(req.user!.userId);
      sendSuccess(res, 'Active sessions fetched', sessions);
    } catch (error) {
      next(error);
    }
  }
}
