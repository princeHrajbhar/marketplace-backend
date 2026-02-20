// src/queues/producer.ts
import { getChannel } from '../config/rabbitmq';
import { env } from '../config/env';
import { EmailJob } from '../types';
import { logger } from '../utils/logger';

/**
 * Publishes an email job to the RabbitMQ emailQueue.
 * Returns true on success, false if RabbitMQ is unavailable (caller should fallback).
 *
 * Messages are persistent (survive broker restart) and the queue is durable.
 */
export const publishEmailJob = async (job: EmailJob): Promise<boolean> => {
  try {
    const channel = getChannel();
    if (!channel) {
      logger.debug('RabbitMQ channel unavailable — producer cannot publish');
      return false;
    }

    const message = Buffer.from(JSON.stringify(job));

    const sent = channel.sendToQueue(env.rabbitmq.queueName, message, {
      persistent: true,                    // Survives RabbitMQ restart
      contentType: 'application/json',
      timestamp: Math.floor(Date.now() / 1000),
      appId: 'marketplace-api',
    });

    if (!sent) {
      logger.warn('RabbitMQ channel buffer full — message may be delayed');
    }

    logger.debug(`📨 Published [${job.type}] → ${job.to}`);
    return true;
  } catch (error) {
    logger.error('Failed to publish email job:', error);
    return false;
  }
};
