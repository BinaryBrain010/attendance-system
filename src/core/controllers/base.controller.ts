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
      logActivity?: {
        action: string | ((result: T) => string);
        entityType: string;
        entityId?: string | ((result: T) => string | undefined);
        description?: string | ((result: T) => string);
        metadata?: any | ((result: T) => any);
      };
      req?: Request;
    }
  ) {
    try {
      const result = await operation();
      if (options?.successMessage) {
        logger.info(options.successMessage);
      }
      
      // Log activity if requested
      if (options?.logActivity && options?.req) {
        this.logActivityAsync(options.req, options.logActivity, result);
      }
      
      return ApiResponse.success(res, result, options?.successMessage, options?.statusCode || 200);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Logs activity asynchronously (non-blocking)
   */
  private async logActivityAsync<T>(
    req: Request,
    logConfig: {
      action: string | ((result: T) => string);
      entityType: string;
      entityId?: string | ((result: T) => string | undefined);
      description?: string | ((result: T) => string);
      metadata?: any | ((result: T) => any);
    },
    result: T
  ): Promise<void> {
    try {
      const { logActivityFromRequest } = await import('../../modules/ActivityLog/helper/activityLog.helper');
      
      const action = typeof logConfig.action === 'function'
        ? logConfig.action(result)
        : logConfig.action;
      
      const entityId = typeof logConfig.entityId === 'function' 
        ? logConfig.entityId(result) 
        : logConfig.entityId;
      
      const description = typeof logConfig.description === 'function'
        ? logConfig.description(result)
        : logConfig.description;
      
      const metadata = typeof logConfig.metadata === 'function'
        ? logConfig.metadata(result)
        : logConfig.metadata;

      const logged = await logActivityFromRequest(
        req,
        action,
        logConfig.entityType,
        entityId,
        description,
        metadata
      );
      
      if (!logged) {
        console.warn('⚠️ Activity log was not created. Check if ActivityLog table exists and Prisma Client is regenerated.');
      }
    } catch (error: any) {
      // Don't throw - activity logging should not break the main flow
      console.error('Error logging activity:', error?.message || error);
      if (error?.message?.includes('ActivityLog') || error?.message?.includes('does not exist')) {
        console.error("⚠️ Please run: npx prisma migrate deploy && npx prisma generate");
      }
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
