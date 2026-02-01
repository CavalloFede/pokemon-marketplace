import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const checks: {
      status: string;
      timestamp: string;
      services: {
        database: string;
        cache: string;
      };
    } = {
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

    // Check Redis (only if configured)
    if (redis) {
      try {
        await redis.ping();
        checks.services.cache = 'healthy';
      } catch {
        checks.services.cache = 'unhealthy';
        // Don't degrade status for optional cache
      }
    }

    const statusCode = checks.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(checks);
  });
}
