import type { Response } from 'express';
import { HTTP_STATUS } from '../constants/httpStatusCodes.js';

export class ApiResponse {
  static success<T>(
    res: Response,
    message: string,
    data: T | null = null,
    statusCode: number = HTTP_STATUS.OK
  ): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errors: unknown = null
  ): Response {
    return res.status(statusCode).json({
      success: false,
      message,
      errors: errors ?? null,
    });
  }
}