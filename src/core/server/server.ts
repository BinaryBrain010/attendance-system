// Patch Express to forward async-handler rejections to the error middleware. Must be imported
// before any routers/layers are created, so it comes first.
import "./asyncErrors";
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
import StatsRoutes from "../../modules/app/stats/routes/stats.routes";
import InsightsRoutes from "../../modules/Insights/routes/insights.routes";
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
import WebhookRoutes from "../../modules/rbac/Access/routes/webhook.routes";
import TokenCleanHelper from '../../helper/schedule.helper';
import { apiLimiter } from '../../middleware/rateLimiter.middleware';
import logger from '../logger/logger';
import { environment } from '../../environment/env.schema';
import { AppError } from '../errors/app.error';
import { sendError } from '../utils/errorEnvelope';
import swaggerUi from 'swagger-ui-express';
import swaggerFactory from '../swagger/swagger.factory';

//AMS
import AttendanceReqRoutes from "../../modules/AMS/Attendance/routes/attendaceReq.routes";
import AttendanceSchedulerHelper from "../../modules/AMS/Attendance/helper/schedule.helper"
import EmployeeRoutes from "../../modules/AMS/Employee/routes/employee.routes";
import AttendanceRoutes from "../../modules/AMS/Attendance/routes/attendance.routes";
import LeaveRoutes from "../../modules/AMS/Leaves/routes/leave.routes";
import HolidayRoutes from "../../modules/AMS/Holiday/routes/holiday.routes";
import UnitRoutes from "../../modules/AMS/Unit/routes/unit.routes";
import UnitEmployeeRoutes from "../../modules/AMS/Unit/routes/unitEmployee.routes";
import ShiftRoutes from "../../modules/AMS/Shift/routes/shift.routes";
import SystemConfigRoutes from "../../modules/AMS/SystemConfig/routes/systemConfig.routes";
import AnalyticsRoutes from "../../modules/AMS/Analytics/routes/analytics.routes";
import ActivityLogRoutes from "../../modules/ActivityLog/routes/activityLog.routes";

//Frontdesk
import VisitorRoutes from "../../modules/Frontdesk/Visitor/routes/visitor.routes";

//CRM (Sales CRM — Okasha Smart)
import CrmCategoryRoutes from "../../modules/CRM/Catalogue/Category/routes/category.routes";
import CrmBrandRoutes from "../../modules/CRM/Catalogue/Brand/routes/brand.routes";
import CrmProductRoutes from "../../modules/CRM/Catalogue/Product/routes/product.routes";
import CrmPriceListRoutes from "../../modules/CRM/Catalogue/PriceList/routes/pricelist.routes";
import CrmBundleRoutes from "../../modules/CRM/Catalogue/Bundle/routes/bundle.routes";
import SalesAgentRoutes from "../../modules/CRM/SalesAgent/routes/salesAgent.routes";
import LeadRoutes from "../../modules/CRM/Lead/routes/lead.routes";
import LeadActivityRoutes from "../../modules/CRM/LeadActivity/routes/leadActivity.routes";
import QuotationRoutes from "../../modules/CRM/Quotation/routes/quotation.routes";
import SalesOrderRoutes from "../../modules/CRM/SalesOrder/routes/salesOrder.routes";
import SalesReturnRoutes from "../../modules/CRM/Return/routes/salesReturn.routes";
import CrmReportRoutes from "../../modules/CRM/Report/routes/report.routes";
import TeamRoutes from "../../modules/Work/Team/routes/team.routes";
import TaskRoutes from "../../modules/Work/Task/routes/task.routes";
import DailyReportRoutes from "../../modules/Work/DailyReport/routes/dailyReport.routes";
import NotificationRoutes from "../../modules/Work/Notification/routes/notification.routes";
import WorkReportRoutes from "../../modules/Work/Report/routes/workReport.routes";
import AuditLogRoutes from "../../modules/Audit/routes/auditLog.routes";
import WorkSchedulerHelper from "../../modules/Work/helper/workSchedule.helper";
import { ensureSystemUser } from "../audit/systemUser";
import { auditBootCheck } from "../audit/auditBoot";

class App {
  private app: Express;
  private server: http.Server | null = null;
  private helper: typeof routesHelper;

  constructor() {
    this.installProcessGuards();
    this.app = express();
    this.helper = routesHelper;
    this.accessControl();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.startServer();
    TokenCleanHelper;
    AttendanceSchedulerHelper;
    WorkSchedulerHelper;
    ensureSystemUser();
    auditBootCheck();
  }

  /**
   * Keep the process alive when a request handler (or anything else) throws asynchronously.
   * Node >= 15 exits the process on an unhandled promise rejection by default, so a single
   * malformed request could take the whole server down. We log and keep serving instead.
   */
  private installProcessGuards(): void {
    process.on('unhandledRejection', (reason: any) => {
      logger.error(`unhandledRejection: ${reason?.stack || reason?.message || reason}`);
    });
    process.on('uncaughtException', (err: Error) => {
      logger.error(`uncaughtException: ${err?.stack || err?.message || err}`);
    });
  }

  private accessControl() {
    // Behind a reverse proxy (nginx / load balancer) the real client IP is in X-Forwarded-For.
    // Trust the first proxy hop so req.ip and the audit context capture the client IP, not the
    // proxy's. Adjust the hop count if there is more than one proxy in front (Run 12 item 4).
    this.app.set("trust proxy", 1);
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
    
    // Configure bodyParser to skip multipart/form-data requests (handled by multer)
    // This prevents bodyParser from interfering with multer's parsing
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const contentType = (req.headers['content-type'] || '').toLowerCase();
      // Skip body parsing for multipart requests - let multer handle it
      if (contentType.includes('multipart/form-data')) {
        return next();
      }
      bodyParser.json({ limit: '50mb' })(req, res, next);
    });
    
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const contentType = (req.headers['content-type'] || '').toLowerCase();
      // Skip body parsing for multipart requests - let multer handle it
      if (contentType.includes('multipart/form-data')) {
        return next();
      }
      bodyParser.urlencoded({ limit: '50mb', extended: true })(req, res, next);
    });
    
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
      StatsRoutes,

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
      AttendanceRoutes,
      HolidayRoutes,
      UnitRoutes,
      UnitEmployeeRoutes,
      ShiftRoutes,
      SystemConfigRoutes,
      AnalyticsRoutes,

      //ActivityLog
      ActivityLogRoutes,

      //Frontdesk
      VisitorRoutes,

      //CRM
      CrmCategoryRoutes,
      CrmBrandRoutes,
      CrmProductRoutes,
      CrmPriceListRoutes,
      CrmBundleRoutes,
      SalesAgentRoutes,
      LeadRoutes,
      LeadActivityRoutes,
      QuotationRoutes,
      SalesOrderRoutes,
      SalesReturnRoutes,
      CrmReportRoutes,
      TeamRoutes,
      TaskRoutes,
      DailyReportRoutes,
      NotificationRoutes,
      WorkReportRoutes,

      //Audit
      AuditLogRoutes,

      //Analytics / Insights
      InsightsRoutes
    ];
    
    const openRoutes: any[] = [AuthRoutes, WebhookRoutes];
    
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

    // Unknown route -> JSON 404 (never Express's default HTML page), so the client always parses JSON.
    this.app.use((req: Request, res: Response) => {
      if (res.headersSent) return;
      res.status(404).json({ success: false, message: "Not found", statusCode: 404 });
    });

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
    
    // Handle multer/busboy boundary errors
    if (err.message && (err.message.includes('Boundary not found') || err.message.includes('Multipart: Boundary not found'))) {
      logger.error('Multer boundary error caught by global handler', {
        path: req.path,
        method: req.method,
        contentType: req.headers['content-type']
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid request: Expected multipart/form-data with proper boundary',
        statusCode: 400
      });
    }
    
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
      // Connection pool exhausted (P2024) or interactive transaction could not start/commit in
      // time (P2028). These are transient overload conditions: tell the client to retry rather
      // than returning a 500 or, worse, letting the rejection crash the process.
      if (prismaError.code === 'P2024' || prismaError.code === 'P2028') {
        return res.status(503).json({
          success: false,
          message: 'Server is busy, please retry in a moment',
          statusCode: 503
        });
      }
    }
    
    // Default: central envelope — classifies the error and gives genuine 500s a ref id that is
    // logged (above + inside sendError) so it is traceable in pm2 logs while the user sees a safe
    // "Something went wrong. Ref: <id>".
    return sendError(res, err, { method: req.method, path: (req as any).originalUrl || req.path, requestId: (req as any).requestId });
  }
}

export default App;

