// src/config/nodemailer.ts
import nodemailer, { Transporter } from 'nodemailer';
import { env } from './env';
import { logger } from '../utils/logger';

let transporter: Transporter | null = null;

export const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: env.email.user,
        pass: env.email.pass,
      },
      pool: true,          // Connection pooling
      maxConnections: 5,
      rateLimit: 10,       // Max 10 messages/second
    });
  }
  return transporter;
};

export const verifyMailer = async (): Promise<void> => {
  try {
    await getTransporter().verify();
    logger.info('✅ Nodemailer SMTP ready');
  } catch (error) {
    logger.warn(`⚠️  SMTP not ready: ${(error as Error).message}`);
  }
};
