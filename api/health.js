import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
});
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      cache: 'disabled'
    }
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.services.database = 'healthy';
  } catch (error) {
    console.error('Database check failed:', error);
    checks.services.database = 'unhealthy';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json(checks);
}
