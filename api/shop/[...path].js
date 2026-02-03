import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Simple shop items query
async function getShopItems() {
  const items = await prisma.shopItem.findMany({
    where: { isActive: true },
    include: { species: true },
    orderBy: [{ itemType: 'asc' }, { price: 'asc' }]
  });
  return items;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ''];
  const path = pathParts.join('/');

  try {
    // GET /api/shop/items (public)
    if (path === 'items' && req.method === 'GET') {
      const items = await getShopItems();
      return res.status(200).json(items);
    }

    // POST /api/shop/purchase - temporarily disabled, needs full service implementation
    if (path === 'purchase' && req.method === 'POST') {
      return res.status(501).json({ error: 'Purchase endpoint is being migrated' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Shop error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
