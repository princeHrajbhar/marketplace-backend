// src/types/index.ts
// ─── Central Type Definitions ─────────────────────────────────────────────────

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum EmailJobType {
  OTP_VERIFICATION = 'otp_verification',
  FORGOT_PASSWORD = 'forgot_password',
  WELCOME = 'welcome',
  PASSWORD_CHANGED = 'password_changed',
}

export enum OtpPurpose {
  EMAIL_VERIFICATION = 'email_verification',
  FORGOT_PASSWORD = 'forgot_password',
}

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

// ── JWT Payloads ──────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
  type: TokenType.ACCESS;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string; // UUID stored in DB — enables per-device revocation
  tokenVersion: number;
  type: TokenType.REFRESH;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

// ── Email Queue ───────────────────────────────────────────────────────────────

export interface EmailJob {
  type: EmailJobType;
  to: string;
  data: Record<string, unknown>;
}

// ── Service Return Types ──────────────────────────────────────────────────────

export interface AuthResult {
  user: Record<string, unknown>;
  tokens: TokenPair;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

// ── Request Augmentation ──────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}
