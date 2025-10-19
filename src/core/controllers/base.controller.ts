import { Request, Response } from 'express';
import AuthHelper from '../../Auth/helper/auth.helper';
import prisma from '../models/base.model';
import { ActivityLog } from '../../types/schema';

abstract class BaseController<T> {
  protected abstract service: T;


  protected async getIpAddress(req: Request): Promise<string> {
    return (
      req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
    ).toString();
  } 

  protected async getRequestMethod(req: Request): Promise<string> {
    return req.method;
  }

  protected async getRoutePath(req: Request): Promise<string> {
    return req.path;
  }

  protected async saveActivityLog(
    req: Request, 
    activityLog: string,
    statusCode: number,
    success: boolean,
    entityId?: string,
    module?: string
  ) {
    const userId = AuthHelper.getUserIdFromHeader(req);
    const userName = AuthHelper.getUserNameForUserId(req);
    const logMessage = `${userName} : ${activityLog} at ${new Date().toISOString()}`;
    const activityLogData: ActivityLog  = {
      userId: userId || '',
      action: logMessage,
      module: module || 'General',
      ip: await this.getIpAddress(req),
      method: await this.getRequestMethod(req),
      route: await this.getRoutePath(req),
      entityId: entityId || '',
      request: req,
      statusCode: statusCode,
      success: success
    }
    await prisma.activityLog.gpCreate({
      activityLogData
    })
    console.log(`Activity Log for User ${userId}: ${activityLog}`);
  }

  protected async handleRequest(
    operation: () => Promise<any>,
    successMessage: string,
    errorMessage: string,
    activityLog: string,
    res: Response,
    req: Request,
    module?: string,
    entityId?: string
  ) {
    try {

      const result = await operation();
      await this.saveActivityLog(req, activityLog, 200, true, entityId, module);
      console.log(successMessage);
      res.status(200).json(result);
    } catch (error) {
      await this.saveActivityLog(req, activityLog, 500, false, entityId, module);
      console.error(errorMessage, error);
      res.status(500).json({ error: errorMessage });
    }
  }


}

export default BaseController;
