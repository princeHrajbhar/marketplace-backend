// src/middlewares/errorMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Global error handler — must be registered LAST in Express middleware chain.
 * Handles Mongoose errors, JWT errors, and generic errors.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`[${req.method} ${req.path}] ${err.name}: ${err.message}`, {
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    userId: req.user?.userId,
  });

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern || {})[0] || 'field';
    res.status(409).json({
      success: false,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
    });
    return;
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(422).json({ success: false, message: messages[0], errors: messages });
    return;
  }

  // Mongoose bad ObjectId
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, message: `Invalid ${err.path}: ${err.value}` });
    return;
  }

  // Default
  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * 404 handler — must be registered BEFORE errorHandler, AFTER all routes.
 */
export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route [${req.method}] ${req.originalUrl} not found`,
  });
};
