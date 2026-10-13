import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { HTTP_STATUS } from '../constants/httpStatusCodes.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { envConfig } from '../config/env.config.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ApiResponse.error(res, 'Authentication token missing or invalid', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, envConfig.jwtSecret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    ApiResponse.error(res, 'Invalid or expired token', HTTP_STATUS.UNAUTHORIZED);
  }
};