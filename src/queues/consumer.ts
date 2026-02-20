// src/queues/consumer.ts
/**
 * ─── Standalone Email Consumer Process ───────────────────────────────────────
 * Run as a separate process: npm run consumer
 *
 * This worker:
 *   1. Connects to RabbitMQ
 *   2. Listens on emailQueue
 *   3. Processes email jobs (OTP, forgot password, welcome, etc.)
 *   4. Acks on success, Nacks on failure (no requeue to avoid loops)
 *
 * In production: run behind a process manager (PM2, Docker, systemd)
 * For Kubernetes: deploy as a separate Deployment with replica count
 */
import dotenv from 'dotenv';
dotenv.config();

import { connectRabbitMQ, getChannel } from '../config/rabbitmq';
import { verifyMailer } from '../config/nodemailer';
import { EmailService } from '../services/emailService';
import { EmailJob, EmailJobType } from '../types';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const emailService = new EmailService();

const processJob = async (job: EmailJob): Promise<void> => {
  const { type, to, data } = job;

  switch (type) {
    case EmailJobType.OTP_VERIFICATION:
      await emailService.sendOtpEmail(to, data.otp as string, data.name as string);
      break;

    case EmailJobType.FORGOT_PASSWORD:
      await emailService.sendForgotPasswordEmail(
        to,
        data.resetLink as string,
        data.name as string
      );
      break;

    case EmailJobType.WELCOME:
      await emailService.sendWelcomeEmail(to, data.name as string);
      break;

    case EmailJobType.PASSWORD_CHANGED:
      await emailService.sendPasswordChangedEmail(to, data.name as string);
      break;

    default:
      logger.warn(`Unknown email job type: ${type}`);
  }
};

const startConsumer = async (): Promise<void> => {
  logger.info('🚀 Starting email consumer process...');

  await connectRabbitMQ();
  await verifyMailer();

  const channel = getChannel();
  if (!channel) {
    logger.error('Cannot start consumer — RabbitMQ channel unavailable');
    process.exit(1);
  }

  // Fair dispatch: process one message at a time
  channel.prefetch(1);

  logger.info(`📬 Listening on queue: ${env.rabbitmq.queueName}`);

  channel.consume(
    env.rabbitmq.queueName,
    async (msg) => {
      if (!msg) return;

      let job: EmailJob | null = null;

      try {
        job = JSON.parse(msg.content.toString()) as EmailJob;
        logger.info(`Processing [${job.type}] → ${job.to}`);

        await processJob(job);

        channel.ack(msg);
        logger.info(`✅ Email sent [${job.type}] → ${job.to}`);
      } catch (error) {
        const jobInfo = job ? `[${job.type}] → ${job.to}` : 'unknown job';
        logger.error(`❌ Failed to process email ${jobInfo}:`, error);

        // Nack without requeue — dead-letter queue in production
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Consumer shutting down...');
    await channel.close();
    process.exit(0);
  });
};

startConsumer().catch((err) => {
  logger.error('Consumer startup failed:', err);
  process.exit(1);
});
