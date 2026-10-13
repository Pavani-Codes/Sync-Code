import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { envConfig } from '../config/env.config.js';
import { HTTP_STATUS } from '../constants/httpStatusCodes.js';

export const globalErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = 'An unexpected error occurred';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === 'ValidationError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = err.message;
  } else if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Resource not found / Invalid Identifier';
  }

  if (envConfig.nodeEnv === 'development') {
    console.error('[Error Details]:', err);
  }

  return ApiResponse.error(res, message, statusCode);
};