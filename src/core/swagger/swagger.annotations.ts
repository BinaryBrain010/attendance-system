/**
 * Common Swagger annotations and helpers
 * Use these to document your API endpoints
 */

export const swaggerAnnotations = {
  /**
   * Common response schemas
   */
  responses: {
    success: {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Success',
            },
          },
        },
      },
    },
    paginated: {
      '200': {
        description: 'Paginated data retrieved successfully',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PaginatedResponse',
            },
          },
        },
      },
    },
    error: {
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
  },

  /**
   * Security schemes
   */
  security: {
    bearerAuth: [
      {
        bearerAuth: [] as string[],
      },
    ],
  },

  /**
   * Common parameter schemas
   */
  parameters: {
    id: {
      name: 'id',
      in: 'path',
      required: true,
      schema: {
        type: 'string',
      },
      description: 'Resource ID',
    },
    page: {
      name: 'page',
      in: 'query',
      required: false,
      schema: {
        type: 'integer',
        default: 1,
        minimum: 1,
      },
      description: 'Page number',
    },
    pageSize: {
      name: 'pageSize',
      in: 'query',
      required: false,
      schema: {
        type: 'integer',
        default: 10,
        minimum: 1,
        maximum: 100,
      },
      description: 'Number of items per page',
    },
  },
};

/**
 * Helper function to generate Swagger documentation string
 */
export function generateSwaggerDoc(doc: {
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  security?: boolean;
  requestBody?: object;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
    schema: object;
    description?: string;
  }>;
  responses?: Record<string, object>;
}): string {
  const security = doc.security ? swaggerAnnotations.security.bearerAuth : undefined;
  
  const swaggerDoc = {
    [doc.method]: {
      summary: doc.summary,
      description: doc.description,
      tags: doc.tags,
      ...(security && { security }),
      ...(doc.parameters && { parameters: doc.parameters }),
      ...(doc.requestBody && { requestBody: doc.requestBody }),
      responses: {
        ...swaggerAnnotations.responses.success,
        ...swaggerAnnotations.responses.error,
        ...doc.responses,
      },
    },
  };

  return `/**
 * @swagger
 * ${doc.path}:
 *   ${JSON.stringify(swaggerDoc[doc.method as keyof typeof swaggerDoc], null, 2).replace(/^/gm, '   ')}
 */`;
}

