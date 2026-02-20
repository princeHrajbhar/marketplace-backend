// src/middlewares/validate.ts
import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { sendError } from '../utils/apiResponse';
import { UserRole } from '../types';

// ── Core validate runner ──────────────────────────────────────────────────────

export const validate = (chains: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(chains.map((c) => c.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const arr = errors.array();
      sendError(res, arr[0].msg, 422, arr);
      return;
    }
    next();
  };
};

// ── Password Rules (shared) ───────────────────────────────────────────────────

const passwordRules = (fieldName = 'password') =>
  body(fieldName)
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&#^()_+\-=]/).withMessage('Password must contain at least one special character');

// ── Auth Validators ───────────────────────────────────────────────────────────

export const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),

  passwordRules('password'),

  body('role')
    .optional()
    .isIn(Object.values(UserRole)).withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),
];

export const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

export const verifyOtpValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Invalid email').normalizeEmail(),

  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits')
    .isNumeric().withMessage('OTP must contain only digits'),
];

export const emailOnlyValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
];

export const forgotPasswordValidation = emailOnlyValidation;
export const resendOtpValidation = emailOnlyValidation;

export const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token format'),

  passwordRules('newPassword'),

  body('confirmPassword')
    .optional()
    .custom((val, { req }) => {
      if (val && val !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

export const refreshTokenValidation = [
  body('refreshToken')
    .optional()
    .isString().withMessage('Refresh token must be a string'),
];

export const googleLoginValidation = [
  body('idToken')
    .notEmpty().withMessage('Google ID token is required')
    .isString().withMessage('ID token must be a string'),
];

// ── Product Validators ────────────────────────────────────────────────────────

export const createProductValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 120 }).withMessage('Title must be 3–120 characters'),

  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a non-negative number')
    .toFloat(),

  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Description must be 10–2000 characters'),

  body('image')
    .trim()
    .notEmpty().withMessage('Image URL is required')
    .isURL({ require_protocol: true }).withMessage('Image must be a valid URL with protocol (http/https)'),
];

export const updateProductValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 120 }).withMessage('Title must be 3–120 characters'),

  body('price')
    .optional()
    .isFloat({ min: 0 }).withMessage('Price must be a non-negative number')
    .toFloat(),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage('Description must be 10–2000 characters'),

  body('image')
    .optional()
    .trim()
    .isURL({ require_protocol: true }).withMessage('Image must be a valid URL'),
];

export const mongoIdParamValidation = [
  param('id').isMongoId().withMessage('Invalid ID format'),
];

export const paginationQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search term cannot exceed 100 characters'),
];
