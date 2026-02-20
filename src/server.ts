import 'dotenv/config';

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import os from 'os';

import { env } from './config/env';
import { connectDB } from './config/db';
import { connectRabbitMQ, closeRabbitMQ } from './config/rabbitmq';
import { verifyMailer } from './config/nodemailer';
import { startInProcessConsumer } from './queues/inProcessConsumer';

import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import { errorHandler, notFound } from './middlewares/errorMiddleware';
import { globalLimiter } from './middlewares/rateLimiter';
import { logger } from './utils/logger';

// ─── Helper: Get Local Network IP ─────────────────────────────────────────────

const getLocalIP = (): string => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

// ─── App Factory ──────────────────────────────────────────────────────────────

const createApp = (): Application => {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());

  app.use(
    cors({
      origin: env.server.frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  app.use(
    morgan('combined', {
      stream: { write: (msg: string) => logger.info(msg.trim()) },
      skip: (_req, res) => res.statusCode < 400 && env.server.isProduction,
    })
  );

  app.use('/api', globalLimiter);

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/products', productRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const bootstrap = async (): Promise<void> => {
  try {
    await connectDB();
    await connectRabbitMQ();
    await verifyMailer();
    await startInProcessConsumer();

    const app = createApp();

    const port = env.server.port;
    const localIP = getLocalIP();

    const server = app.listen(port, '0.0.0.0', () => {
      const localUrl = `http://localhost:${port}`;
      const networkUrl = `http://${localIP}:${port}`;

      logger.info('');
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info('          🛍️  Micro Marketplace API v2.0 Started              ');
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info(`  🚀 Local Server   : ${localUrl}`);
      logger.info(`  🌐 Network Server : ${networkUrl}`);
      logger.info(`  📡 API Base       : ${localUrl}/api/v1`);
      logger.info(`  🏥 Health         : ${localUrl}/health`);
      logger.info(`  🌍 Environment    : ${env.server.nodeEnv}`);
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info('');
    });

    // ── Graceful Shutdown ───────────────────────────────────────────────────────

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`\n${signal} received — shutting down gracefully`);
      server.close(async () => {
        await closeRabbitMQ();
        logger.info('✅ Server closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Could not close server in time — forcefully exiting');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Bootstrap failed:', error);
    process.exit(1);
  }
};

bootstrap();




// // src/server.ts
// import 'dotenv/config';

// import express, { Application } from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import cookieParser from 'cookie-parser';

// import { env } from './config/env';
// import { connectDB } from './config/db';
// import { connectRabbitMQ, closeRabbitMQ } from './config/rabbitmq';
// import { verifyMailer } from './config/nodemailer';
// import { startInProcessConsumer } from './queues/inProcessConsumer';

// import authRoutes from './routes/authRoutes';
// import productRoutes from './routes/productRoutes';
// import { errorHandler, notFound } from './middlewares/errorMiddleware';
// import { globalLimiter } from './middlewares/rateLimiter';
// import { logger } from './utils/logger';

// // ─── App Factory ──────────────────────────────────────────────────────────────

// const createApp = (): Application => {
//   const app = express();

//   // ── Trust proxy (for correct IP behind nginx/load balancer) ─────────────────
//   app.set('trust proxy', 1);

//   // ── Security Headers ─────────────────────────────────────────────────────────
//   app.use(helmet());

//   // ── CORS ──────────────────────────────────────────────────────────────────────
//   app.use(
//     cors({
//       origin: env.server.frontendUrl,
//       credentials: true,
//       methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//       allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//       exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
//     })
//   );

//   // ── Body Parsing ─────────────────────────────────────────────────────────────
//   app.use(express.json({ limit: '10mb' }));
//   app.use(express.urlencoded({ extended: true, limit: '10mb' }));
//   app.use(cookieParser()); // For reading HttpOnly refresh token cookie

//   // ── HTTP Request Logging ──────────────────────────────────────────────────────
//   app.use(
//     morgan('combined', {
//       stream: { write: (msg: string) => logger.info(msg.trim()) },
//       skip: (_req, res) => res.statusCode < 400 && env.server.isProduction,
//     })
//   );

//   // ── Global Rate Limiting ─────────────────────────────────────────────────────
//   app.use('/api', globalLimiter);

//   // ── Health Check ─────────────────────────────────────────────────────────────
//   app.get('/health', (_req, res) => {
//     res.json({
//       success: true,
//       status: 'healthy',
//       version: '2.0.0',
//       timestamp: new Date().toISOString(),
//       uptime: Math.floor(process.uptime()),
//     });
//   });

//   // ── API Routes ────────────────────────────────────────────────────────────────
//   app.use('/api/v1/auth', authRoutes);
//   app.use('/api/v1/products', productRoutes);

//   // ── 404 & Error Handling ──────────────────────────────────────────────────────
//   app.use(notFound);
//   app.use(errorHandler);

//   return app;
// };

// // ─── Bootstrap ────────────────────────────────────────────────────────────────

// const bootstrap = async (): Promise<void> => {
//   try {
//     await connectDB();
//     await connectRabbitMQ();
//     await verifyMailer();
//     await startInProcessConsumer(); // Start in-process consumer

//     const app = createApp();

//     const server = app.listen(env.server.port, () => {
//       const base = `http://localhost:${env.server.port}`;
//       logger.info('');
//       logger.info('═══════════════════════════════════════════════════════════════');
//       logger.info('          🛍️  Micro Marketplace API v2.0 Started              ');
//       logger.info('═══════════════════════════════════════════════════════════════');
//       logger.info(`  🚀 Server      : ${base}`);
//       logger.info(`  📡 API Base    : ${base}/api/v1`);
//       logger.info(`  🏥 Health      : ${base}/health`);
//       logger.info(`  🌍 Environment : ${env.server.nodeEnv}`);
//       logger.info('───────────────────────────────────────────────────────────────');
//       logger.info('  🔐 AUTH ENDPOINTS:');
//       logger.info(`     POST  ${base}/api/v1/auth/register`);
//       logger.info(`     POST  ${base}/api/v1/auth/verify-otp`);
//       logger.info(`     POST  ${base}/api/v1/auth/resend-otp`);
//       logger.info(`     POST  ${base}/api/v1/auth/login`);
//       logger.info(`     POST  ${base}/api/v1/auth/admin/login`);
//       logger.info(`     POST  ${base}/api/v1/auth/google`);
//       logger.info(`     POST  ${base}/api/v1/auth/refresh-token`);
//       logger.info(`     POST  ${base}/api/v1/auth/forgot-password`);
//       logger.info(`     POST  ${base}/api/v1/auth/reset-password`);
//       logger.info(`     GET   ${base}/api/v1/auth/me`);
//       logger.info(`     GET   ${base}/api/v1/auth/sessions`);
//       logger.info(`     POST  ${base}/api/v1/auth/logout`);
//       logger.info(`     POST  ${base}/api/v1/auth/logout-all`);
//       logger.info('───────────────────────────────────────────────────────────────');
//       logger.info('  📦 PRODUCT ENDPOINTS:');
//       logger.info(`     GET    ${base}/api/v1/products                  (public)`);
//       logger.info(`     GET    ${base}/api/v1/products/:id              (public)`);
//       logger.info(`     GET    ${base}/api/v1/products/user/favorites   (auth)`);
//       logger.info(`     POST   ${base}/api/v1/products                  (admin)`);
//       logger.info(`     PUT    ${base}/api/v1/products/:id              (admin)`);
//       logger.info(`     DELETE ${base}/api/v1/products/:id              (admin)`);
//       logger.info(`     POST   ${base}/api/v1/products/:id/favorite     (auth)`);
//       logger.info(`     DELETE ${base}/api/v1/products/:id/favorite     (auth)`);
//       logger.info('═══════════════════════════════════════════════════════════════');
//       logger.info('');
//     });

//     // ── Graceful Shutdown ───────────────────────────────────────────────────────
//     const shutdown = async (signal: string): Promise<void> => {
//       logger.info(`\n${signal} received — shutting down gracefully`);
//       server.close(async () => {
//         await closeRabbitMQ();
//         logger.info('✅ Server closed');
//         process.exit(0);
//       });
//       // Force exit after 10 seconds
//       setTimeout(() => {
//         logger.error('Could not close server in time — forcefully exiting');
//         process.exit(1);
//       }, 10_000);
//     };

//     process.on('SIGTERM', () => shutdown('SIGTERM'));
//     process.on('SIGINT', () => shutdown('SIGINT'));

//     process.on('unhandledRejection', (reason) => {
//       logger.error('Unhandled Promise Rejection:', reason);
//     });

//     process.on('uncaughtException', (err) => {
//       logger.error('Uncaught Exception:', err);
//       process.exit(1);
//     });
//   } catch (error) {
//     logger.error('Bootstrap failed:', error);
//     process.exit(1);
//   }
// };

// bootstrap();
