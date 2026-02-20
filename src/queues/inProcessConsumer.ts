// src/queues/inProcessConsumer.ts
/**
 * In-process email consumer.
 * Used when running as a single process (dev/small deployments).
 * For production, prefer the standalone consumer.ts process.
 */
import { getChannel } from '../config/rabbitmq';
import { EmailService } from '../services/emailService';
import { EmailJob, EmailJobType } from '../types';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const emailService = new EmailService();

export const startInProcessConsumer = async (): Promise<void> => {
  const channel = getChannel();
  if (!channel) {
    logger.warn('RabbitMQ unavailable — in-process consumer not started. Direct email fallback active.');
    return;
  }

  channel.prefetch(1);
  logger.info(`📬 In-process consumer active on: ${env.rabbitmq.queueName}`);

  channel.consume(
    env.rabbitmq.queueName,
    async (msg) => {
      if (!msg) return;
      try {
        const job: EmailJob = JSON.parse(msg.content.toString());

        switch (job.type) {
          case EmailJobType.OTP_VERIFICATION:
            await emailService.sendOtpEmail(job.to, job.data.otp as string, job.data.name as string);
            break;
          case EmailJobType.FORGOT_PASSWORD:
            await emailService.sendForgotPasswordEmail(job.to, job.data.resetLink as string, job.data.name as string);
            break;
          case EmailJobType.WELCOME:
            await emailService.sendWelcomeEmail(job.to, job.data.name as string);
            break;
          case EmailJobType.PASSWORD_CHANGED:
            await emailService.sendPasswordChangedEmail(job.to, job.data.name as string);
            break;
        }

        channel.ack(msg);
      } catch (error) {
        logger.error('In-process consumer error:', error);
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );
};
