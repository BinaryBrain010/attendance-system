import { Request, Response } from 'express';
import { AppError } from '../errors/app.error';
import { ApiResponse } from '../utils/response.util';
import logger from '../logger/logger';

abstract class BaseController<T> {
  protected abstract service: T;

  protected async handleRequest<T>(
    operation: () => Promise<T>,
    res: Response,
    options?: {
      successMessage?: string;
      statusCode?: number;
    }
  ) {
    try {
      const result = await operation();
      if (options?.successMessage) {
        logger.info(options.successMessage);
      }
      return ApiResponse.success(res, result, options?.successMessage, options?.statusCode || 200);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  protected handleError(error: unknown, res: Response) {
    if (error instanceof AppError) {
      logger.warn(`AppError: ${error.message}`, { statusCode: error.statusCode });
      return ApiResponse.error(res, error.message, error.statusCode);
    }
    
    logger.error('Unexpected error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
}

export default BaseController;
