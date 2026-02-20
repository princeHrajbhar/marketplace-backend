// src/config/rabbitmq.ts
import amqplib, { Connection, Channel } from 'amqplib';
import { env } from './env';
import { logger } from '../utils/logger';

let connection: Connection | null = null;
let channel: Channel | null = null;
let isConnecting = false;

export const connectRabbitMQ = async (): Promise<void> => {
  if (isConnecting) return;
  isConnecting = true;

  try {
    connection = await amqplib.connect(env.rabbitmq.url);
    channel = await connection.createChannel();

    // Durable queue — survives broker restarts
    await channel.assertQueue(env.rabbitmq.queueName, {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000, // 24h message TTL
      },
    });

    logger.info('✅ RabbitMQ connected');

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err.message);
      resetAndReconnect();
    });
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed — scheduling reconnect');
      resetAndReconnect();
    });

    isConnecting = false;
  } catch (error) {
    isConnecting = false;
    logger.warn(
      `⚠️  RabbitMQ unavailable: ${(error as Error).message}. Emails will send directly.`
    );
  }
};

const resetAndReconnect = (): void => {
  connection = null;
  channel = null;
  isConnecting = false;
  setTimeout(connectRabbitMQ, 5000);
};

export const getChannel = (): Channel | null => channel;

export const closeRabbitMQ = async (): Promise<void> => {
  try {
    await channel?.close();
    await connection?.close();
    logger.info('RabbitMQ connection closed gracefully');
  } catch {
    // ignore close errors during shutdown
  }
};
