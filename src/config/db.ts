// src/config/db.ts
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.mongo.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('✅ MongoDB connected successfully');

    mongoose.connection.on('error', (err) =>
      logger.error('MongoDB runtime error:', err)
    );
    mongoose.connection.on('disconnected', () =>
      logger.warn('MongoDB disconnected — will auto-reconnect')
    );
    mongoose.connection.on('reconnected', () =>
      logger.info('MongoDB reconnected')
    );

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed on app termination');
    });
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};
