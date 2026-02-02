import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler } from '../apps/api/src/utils/handler.js';
import { prisma } from '../apps/api/src/lib/prisma.js';

export default createHandler({
  GET: async (_req: VercelRequest, res: VercelResponse) => {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        cache: 'disabled'
      }
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.services.database = 'healthy';
    } catch {
      checks.services.database = 'unhealthy';
      checks.status = 'degraded';
    }

    // Redis removed - cache always disabled in serverless

    const statusCode = checks.status === 'ok' ? 200 : 503;
    return res.status(statusCode).json(checks);
  }
});
