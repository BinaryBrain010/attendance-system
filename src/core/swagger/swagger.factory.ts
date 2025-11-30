import swaggerJsdoc from 'swagger-jsdoc';
import { environment } from '../../environment/env.schema';

interface SwaggerOptions {
  title?: string;
  version?: string;
  description?: string;
  basePath?: string;
  apis?: string[];
}

class SwaggerFactory {
  private defaultOptions: SwaggerOptions = {
    title: 'Gate Pass & Attendance Management API',
    version: '1.0.0',
    description: 'RESTful API documentation for Gate Pass and Attendance Management System',
    basePath: '/api',
    apis: [
      './src/**/*.routes.ts',
      './src/**/*.controller.ts',
      './src/Auth/**/*.ts',
    ],
  };

  /**
   * Creates Swagger specification
   */
  createSwaggerSpec(options?: SwaggerOptions): swaggerJsdoc.Options {
    const mergedOptions = { ...this.defaultOptions, ...options };

    const swaggerDefinition = {
      openapi: '3.0.0',
      info: {
        title: mergedOptions.title!,
        version: mergedOptions.version!,
        description: mergedOptions.description!,
        contact: {
          name: 'API Support',
          email: 'ahadnawaz585@gmail.com',
        },
        license: {
          name: 'ISC',
        },
      },
      servers: [
        {
          url: `http://localhost:${environment.port}`,
          description: 'Development server',
        },
        {
          url: `https://api.yourdomain.com`,
          description: 'Production server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter JWT token',
          },
        },
        responses: {
          '400': {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Not Found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '409': {
            description: 'Conflict',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: false,
              },
              message: {
                type: 'string',
                example: 'Error message',
              },
              statusCode: {
                type: 'number',
                example: 400,
              },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                },
              },
            },
          },
          Success: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              message: {
                type: 'string',
                example: 'Success message',
              },
              data: {
                type: 'object',
              },
              statusCode: {
                type: 'number',
                example: 200,
              },
            },
          },
          PaginatedResponse: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              message: {
                type: 'string',
                example: 'Data retrieved successfully',
              },
              data: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                    },
                  },
                  totalSize: {
                    type: 'number',
                    example: 100,
                  },
                },
              },
              statusCode: {
                type: 'number',
                example: 200,
              },
            },
          },
        },
      },
      tags: [
        {
          name: 'Authentication',
          description: 'Authentication endpoints',
        },
        {
          name: 'Users',
          description: 'User management endpoints',
        },
        {
          name: 'Roles',
          description: 'Role management endpoints',
        },
        {
          name: 'Groups',
          description: 'Group management endpoints',
        },
        {
          name: 'Employees',
          description: 'Employee management endpoints',
        },
        {
          name: 'Attendance',
          description: 'Attendance management endpoints',
        },
        {
          name: 'Leaves',
          description: 'Leave management endpoints',
        },
        {
          name: 'Gate Pass',
          description: 'Gate pass management endpoints',
        },
        {
          name: 'Items',
          description: 'Item management endpoints',
        },
        {
          name: 'Customers',
          description: 'Customer management endpoints',
        },
      ],
    };

    const swaggerOptions: swaggerJsdoc.Options = {
      definition: swaggerDefinition,
      apis: mergedOptions.apis!,
    };

    return swaggerOptions;
  }

  /**
   * Generates Swagger specification
   */
  generateSpec(options?: SwaggerOptions): object {
    const swaggerOptions = this.createSwaggerSpec(options);
    return swaggerJsdoc(swaggerOptions);
  }
}

export default new SwaggerFactory();

