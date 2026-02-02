import type { VercelRequest, VercelResponse } from '@vercel/node';

export type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>;
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

interface CorsOptions {
  origin?: string | string[];
  methods?: Method[];
  allowedHeaders?: string[];
  credentials?: boolean;
}

const defaultCorsOptions: CorsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN || '*'
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

function setCorsHeaders(res: VercelResponse, options: CorsOptions = defaultCorsOptions) {
  const origin = Array.isArray(options.origin) ? options.origin.join(', ') : options.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', (options.methods || defaultCorsOptions.methods!).join(', '));
  res.setHeader('Access-Control-Allow-Headers', (options.allowedHeaders || defaultCorsOptions.allowedHeaders!).join(', '));
  if (options.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

/**
 * Create a Vercel serverless function handler with support for multiple HTTP methods
 */
export function createHandler(
  handlers: Partial<Record<Method, Handler>>,
  options?: { cors?: CorsOptions }
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Set CORS headers
    setCorsHeaders(res, options?.cors);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const method = req.method as Method;
    const handler = handlers[method];

    if (!handler) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      await handler(req, res);
    } catch (error) {
      console.error('Handler error:', error);

      // Don't send response if headers already sent
      if (res.headersSent) {
        return;
      }

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Custom error class for API errors with status codes
 */
export class ApiError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Helper to parse query parameters
 */
export function parseQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Helper to parse numeric query parameters
 */
export function parseIntParam(value: string | string[] | undefined, defaultValue?: number): number | undefined {
  const str = parseQueryParam(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Helper to parse boolean query parameters
 */
export function parseBoolParam(value: string | string[] | undefined): boolean | undefined {
  const str = parseQueryParam(value);
  if (str === 'true') return true;
  if (str === 'false') return false;
  return undefined;
}
