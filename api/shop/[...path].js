import { requireAuth, AuthError } from '../../apps/api/dist/src/utils/auth.js';
import { shopService } from '../../apps/api/dist/src/services/shop.service.js';

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
      const items = await shopService.getShopItems();
      return res.status(200).json(items);
    }

    // POST /api/shop/purchase (requires auth)
    if (path === 'purchase' && req.method === 'POST') {
      const auth = await requireAuth(req);
      const { itemId } = req.body || {};
      if (!itemId) {
        return res.status(400).json({ error: 'itemId is required' });
      }
      const result = await shopService.purchaseItem(auth.userId, itemId);
      return res.status(200).json({
        success: true,
        pokemon: result.pokemon,
        newBalance: result.newBalance,
        isNewPokedexEntry: result.isNewPokedexEntry,
        isShiny: result.isShiny,
        rolledRarity: result.rolledRarity
      });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Shop error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      if (error.message === 'Insufficient coins') {
        return res.status(400).json({ error: error.message });
      }
      if (error.message === 'Item not available') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
