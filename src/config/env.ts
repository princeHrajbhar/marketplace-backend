// src/config/env.ts
// ─── Centralised, validated environment configuration ─────────────────────────
import dotenv from 'dotenv';
dotenv.config();

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`❌ Missing required environment variable: ${key}`);
  return value;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] || fallback;

export const env = {
  server: {
    port: parseInt(optional('PORT', '5000'), 10),
    nodeEnv: optional('NODE_ENV', 'development'),
    frontendUrl: optional('FRONTEND_URL', 'http://localhost:3000'),
    isProduction: optional('NODE_ENV', 'development') === 'production',
  },
  mongo: {
    uri: required('MONGO_URI'),
  },
  jwt: {
    accessSecret: required('JWT_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: optional('JWT_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },
  rabbitmq: {
    url: required('RABBITMQ_URL'),
    queueName: 'emailQueue',
  },
  email: {
    user: required('EMAIL_USER'),
    pass: required('EMAIL_PASS'),
    from: optional('EMAIL_FROM', required('EMAIL_USER')),
  },
  google: {
    clientId: optional('GOOGLE_CLIENT_ID', ''),
    clientSecret: optional('GOOGLE_CLIENT_SECRET', ''),
  },
  otp: {
    expiresMinutes: parseInt(optional('OTP_EXPIRES_MINUTES', '10'), 10),
    resendCooldownSeconds: parseInt(optional('OTP_RESEND_COOLDOWN_SECONDS', '60'), 10),
    maxAttempts: parseInt(optional('OTP_MAX_ATTEMPTS', '5'), 10),
  },
  bcrypt: {
    saltRounds: parseInt(optional('BCRYPT_SALT_ROUNDS', '12'), 10),
  },
  cookie: {
    secure: optional('COOKIE_SECURE', 'false') === 'true',
  },
};
