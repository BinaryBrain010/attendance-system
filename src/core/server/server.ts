import express, { Express, Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import http from "http";
import CustomerRoutes from "../../modules/app/customer/routes/customer.routes";
const cookieParser = require("cookie-parser");

import GatePassRoutes from "../../modules/app/gatePass/routes/gatePass.routes";
import GatePassItemRoutes from "../../modules/app/gatePassItem/routes/gatePassItem.routes";
import ItemRoutes from "../../modules/app/item/routes/item.routes";
import AuthRoutes from "../../Auth/routes/auth.routes";

import path from "path";

// import UserDataRoutes from "../../modules/rbac/user/routes/userData.routes";
import UserRoutes from "../../modules/rbac/user/routes/user.routes";
import RoleRoutes from "../../modules/rbac/role/routes/role.routes";
import AccessRoutes from "../../modules/rbac/Access/routes/access.routes";
import GroupRoutes from "../../modules/rbac/group/routes/group.routes";
import routesHelper from "../../helper/routes.helper";
import GroupRoleRoutes from "../../modules/rbac/group/routes/groupRole.routes";
import UserGroupRoutes from "../../modules/rbac/group/routes/userGroup.routes";
import AppFeatureRoutes from "../../modules/rbac/Features/routes/feature.routes";
import UserRoleRoutes from "../../modules/rbac/user/routes/userRole.routes";
import FeaturePermissionRoutes from "../../modules/rbac/Features/routes/featurePermission.routes";
import TokenCleanHelper from '../../helper/schedule.helper';
import { apiLimiter } from '../../middleware/rateLimiter.middleware';
import logger from '../logger/logger';
import { environment } from '../../environment/env.schema';
import { AppError } from '../errors/app.error';
import swaggerUi from 'swagger-ui-express';
import swaggerFactory from '../swagger/swagger.factory';

//AMS
import AttendanceReqRoutes from "../../modules/AMS/Attendance/routes/attendaceReq.routes";
import AttendanceSchedulerHelper from "../../modules/AMS/Attendance/helper/schedule.helper"
import EmployeeRoutes from "../../modules/AMS/Employee/routes/employee.routes";
import AttendanceRoutes from "../../modules/AMS/Attendance/routes/attendance.routes";
import LeaveRoutes from "../../modules/AMS/Leaves/routes/leave.routes";

class App {
  private app: Express;
  private server: http.Server | null = null;
  private helper: typeof routesHelper;

  constructor() {
    this.app = express();
    this.helper = routesHelper;
    this.accessControl();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.startServer();
    TokenCleanHelper;
    AttendanceSchedulerHelper;
  }

  private accessControl() {
    this.app.use(cors({ 
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (environment.allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
    }));
    
    this.app.use(cookieParser());
  }

  private initializeMiddleware() {
    // Enable compression for all responses (gzip/deflate)
    // This significantly reduces response size and improves latency
    this.app.use(compression({
      filter: (req: Request, res: Response) => {
        // Don't compress responses if request explicitly asks for no compression
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Use compression filter function
        return compression.filter(req, res);
      },
      level: 6, // Compression level (1-9, 6 is a good balance)
      threshold: 1024, // Only compress responses larger than 1KB
    }));

    // Initialize Swagger
    this.initializeSwagger();
    
    // Apply general API rate limiting
    this.app.use('/api', apiLimiter);
    
    this.app.use(bodyParser.json({ limit: '50mb' }));;
    this.app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    this.app.use('/uploads', express.static(path.join(__dirname, '..','..',  'assets', 'uploads')));
  }

  private initializeSwagger() {
    try {
      const swaggerSpec = swaggerFactory.generateSpec();
      
      // Swagger UI options
      const swaggerUiOptions = {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Gate Pass API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
        },
      };

      // Swagger JSON endpoint
      this.app.get('/api-docs.json', (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
      });

      // Swagger UI endpoint
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
      
      logger.info('Swagger documentation available at /api-docs');
    } catch (error) {
      logger.error('Failed to initialize Swagger:', error);
    }
  }

  private initializeRoutes(): void {
    const routes: any[] = [
      //App
      CustomerRoutes,
      GatePassRoutes,
      GatePassItemRoutes,
      ItemRoutes,

      //Rbac
      GroupRoutes,
      GroupRoleRoutes,
      RoleRoutes,
      UserRoutes,
      UserGroupRoutes,
      UserRoleRoutes,
      FeaturePermissionRoutes,
      AccessRoutes,
      AppFeatureRoutes,

      //AMS
      EmployeeRoutes,
      LeaveRoutes,
      AttendanceReqRoutes,
      AttendanceRoutes
    ];
    
    const openRoutes: any[] = [AuthRoutes];
    
    // Health check endpoint with timezone info
    this.app.get("/", (req: Request, res: Response) => {
      const now = new Date();
      const pakistanTime = now.toLocaleString("en-US", { 
        timeZone: "Asia/Karachi",
        dateStyle: 'full',
        timeStyle: 'long'
      });
      const utcTime = now.toISOString();
      
      res.json({ 
        message: `App is running`,
        serverTimezone: process.env.TZ || 'Asia/Karachi',
        systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currentTime: {
          utc: utcTime,
          pakistan: pakistanTime,
          timestamp: now.getTime()
        }
      });
    });

    this.helper.initializeRoutes(this.app, true, routes);
    this.helper.initializeRoutes(this.app, false, openRoutes);

    // Error handling middleware should be placed after all other middleware and routes
    this.app.use(this.handleErrors.bind(this));
  }

  private async startServer(): Promise<void> {
    const port = environment.port;
    
    // Set timezone to Pakistan (Asia/Karachi) for the Node.js process
    process.env.TZ = 'Asia/Karachi';
    
    // Create HTTP server with optimized settings
    this.server = http.createServer(this.app);
    
    // Optimize HTTP server for better performance
    // Enable keep-alive to reuse connections
    this.server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than default)
    this.server.headersTimeout = 66000; // Must be > keepAliveTimeout
    this.server.maxHeadersCount = 2000; // Increase max headers
    
    // Handle server errors
    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      
      const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
      
      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
    
    this.server.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
      logger.info(`Environment: ${environment.nodeEnv}`);
      logger.info(`Timezone: ${process.env.TZ || 'Asia/Karachi'}`);
      logger.info(`Uploads path: ${path.join(__dirname, '..','..',  'assets', 'uploads')}`);
      logger.info(`Compression: Enabled`);
      logger.info(`Keep-Alive: Enabled (${this.server?.keepAliveTimeout}ms)`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }
    });
  }

  private handleErrors(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    logger.error('Error occurred:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
    
    // Handle CORS errors
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({
        success: false,
        message: 'CORS: Origin not allowed',
        statusCode: 403
      });
    }
    
    // Handle known AppError instances
    if ('statusCode' in err && 'isOperational' in err) {
      const appError = err as AppError;
      return res.status(appError.statusCode).json({
        success: false,
        message: appError.message,
        statusCode: appError.statusCode
      });
    }
    
    // Handle Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
      const prismaError = err as { code?: string; meta?: unknown };
      if (prismaError.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'A record with this value already exists',
          statusCode: 409
        });
      }
      if (prismaError.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Record not found',
          statusCode: 404
        });
      }
    }
    
    // Default error response
    const statusCode = (err as { statusCode?: number }).statusCode || 500;
    const message = environment.nodeEnv === 'production' 
      ? 'Internal server error' 
      : err.message;
    
    res.status(statusCode).json({
      success: false,
      message,
      ...(environment.nodeEnv !== 'production' && { stack: err.stack }),
      statusCode
    });
  }
}

export default App;

