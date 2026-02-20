// src/routes/authRoutes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { authLimiter, otpLimiter, refreshLimiter } from '../middlewares/rateLimiter';
import {
  registerValidation,
  loginValidation,
  verifyOtpValidation,
  resendOtpValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  googleLoginValidation,
  refreshTokenValidation,
} from '../middlewares/validate';

const router = Router();
const ctrl = new AuthController();

// ─── Public Routes ─────────────────────────────────────────────────────────────

/**
 * @route   POST /auth/register
 * @desc    Register a new user account. Sends OTP to email.
 * @access  Public
 * @body    { name, email, password, role? }
 */
router.post(
  '/register',
  authLimiter,
  validate(registerValidation),
  ctrl.register.bind(ctrl)
);

/**
 * @route   POST /auth/verify-otp
 * @desc    Verify email with OTP. Returns access + refresh token.
 * @access  Public
 * @body    { email, otp }
 */
router.post(
  '/verify-otp',
  authLimiter,
  validate(verifyOtpValidation),
  ctrl.verifyOtp.bind(ctrl)
);

/**
 * @route   POST /auth/resend-otp
 * @desc    Resend OTP (60s cooldown between requests).
 * @access  Public
 * @body    { email }
 */
router.post(
  '/resend-otp',
  otpLimiter,
  validate(resendOtpValidation),
  ctrl.resendOtp.bind(ctrl)
);

/**
 * @route   POST /auth/login
 * @desc    Login with email + password. Returns access + refresh token.
 * @access  Public
 * @body    { email, password }
 */
router.post(
  '/login',
  authLimiter,
  validate(loginValidation),
  ctrl.login.bind(ctrl)
);

/**
 * @route   POST /auth/admin/login
 * @desc    Admin-only login.
 * @access  Public (admin credentials required)
 * @body    { email, password }
 */
router.post(
  '/admin/login',
  authLimiter,
  validate(loginValidation),
  ctrl.adminLogin.bind(ctrl)
);

/**
 * @route   POST /auth/google
 * @desc    Google OAuth login/register via ID token from frontend.
 * @access  Public
 * @body    { idToken }
 */
router.post(
  '/google',
  authLimiter,
  validate(googleLoginValidation),
  ctrl.googleLogin.bind(ctrl)
);

/**
 * @route   POST /auth/refresh-token
 * @desc    Rotate refresh token → issue new access + refresh token pair.
 *          Accepts refresh token via HttpOnly cookie OR request body.
 * @access  Public (requires valid refresh token)
 * @body    { refreshToken? }
 */
router.post(
  '/refresh-token',
  refreshLimiter,
  validate(refreshTokenValidation),
  ctrl.refreshToken.bind(ctrl)
);

/**
 * @route   POST /auth/forgot-password
 * @desc    Send password reset link to email.
 * @access  Public
 * @body    { email }
 */
router.post(
  '/forgot-password',
  otpLimiter,
  validate(forgotPasswordValidation),
  ctrl.forgotPassword.bind(ctrl)
);

/**
 * @route   POST /auth/reset-password
 * @desc    Reset password using token from email.
 * @access  Public
 * @body    { token, newPassword }
 */
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordValidation),
  ctrl.resetPassword.bind(ctrl)
);

// ─── Protected Routes ──────────────────────────────────────────────────────────

/**
 * @route   GET /auth/me
 * @desc    Get current authenticated user's profile.
 * @access  Private
 */
router.get('/me', authenticate, ctrl.getMe.bind(ctrl));

/**
 * @route   GET /auth/sessions
 * @desc    List all active sessions (refresh tokens) for current user.
 * @access  Private
 */
router.get('/sessions', authenticate, ctrl.getSessions.bind(ctrl));

/**
 * @route   POST /auth/logout
 * @desc    Logout current device (revoke current refresh token).
 * @access  Private
 * @body    { refreshToken? } (or via cookie)
 */
router.post('/logout', authenticate, ctrl.logout.bind(ctrl));

/**
 * @route   POST /auth/logout-all
 * @desc    Logout ALL devices (revokes all refresh tokens + bumps tokenVersion).
 * @access  Private
 */
router.post('/logout-all', authenticate, ctrl.logoutAll.bind(ctrl));

export default router;
