// src/utils/apiResponse.ts
import { Response } from 'express';
import { PaginationMeta } from '../types';

interface SuccessResponse<T> {
  success: true;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: unknown;
}

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200,
  meta?: PaginationMeta
): Response => {
  const body: SuccessResponse<T> = { success: true, message };
  if (data !== undefined) body.data = data;
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const sendCreated = <T>(res: Response, message: string, data?: T): Response =>
  sendSuccess(res, message, data, 201);

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown
): Response => {
  const body: ErrorResponse = { success: false, message };
  if (errors && process.env.NODE_ENV !== 'production') body.errors = errors;
  return res.status(statusCode).json(body);
};

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response =>
  sendError(res, message, 401);

export const sendForbidden = (res: Response, message = 'Forbidden'): Response =>
  sendError(res, message, 403);

export const sendNotFound = (res: Response, message = 'Not found'): Response =>
  sendError(res, message, 404);

export const sendConflict = (res: Response, message = 'Conflict'): Response =>
  sendError(res, message, 409);

export const sendTooManyRequests = (res: Response, message: string): Response =>
  sendError(res, message, 429);

export const sendServerError = (res: Response, message = 'Internal server error'): Response =>
  sendError(res, message, 500);
