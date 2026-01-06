import rateLimit from 'express-rate-limit';
import { environment } from '../environment/env.schema';

const isDevelopment = environment.nodeEnv === 'development';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // Higher limit in dev, 100 in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment, // Bypass in development
});

// Strict rate limiter for login endpoints
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 100 : 15, // 100 attempts in dev, 15 in production (increased from 5)
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skip: () => isDevelopment, // Bypass completely in development
});

