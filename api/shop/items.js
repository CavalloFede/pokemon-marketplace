import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
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

  try {
    const items = await prisma.shopItem.findMany({
      where: { isActive: true },
      include: { species: true },
      orderBy: [{ itemType: 'asc' }, { price: 'asc' }]
    });
    return res.status(200).json(items);
  } catch (error) {
    console.error('Shop items error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
