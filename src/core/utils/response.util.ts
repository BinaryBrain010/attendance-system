import { Response } from 'express';

export class ApiResponse {
  static success<T>(res: Response, data: T, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      statusCode
    });
  }

  static error(res: Response, message: string, statusCode = 500, errors?: any[]) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      statusCode
    });
  }
}

