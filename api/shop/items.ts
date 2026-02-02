import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler } from '../../apps/api/src/utils/handler.js';
import { shopService } from '../../apps/api/src/services/shop.service.js';

export default createHandler({
  // GET /api/shop/items - Get available shop items
  GET: async (_req: VercelRequest, res: VercelResponse) => {
    const items = await shopService.getShopItems();
    return res.status(200).json(items);
  }
});
