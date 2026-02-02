import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { shopService } from '../../apps/api/src/services/shop.service.js';

export default createHandler({
  // POST /api/shop/purchase - Purchase an item
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { itemId } = req.body || {};

      if (!itemId) {
        throw new ApiError('itemId is required', 400);
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
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      if (error instanceof Error) {
        if (error.message === 'Insufficient coins') {
          throw new ApiError(error.message, 400);
        }
        if (error.message === 'Item not available') {
          throw new ApiError(error.message, 404);
        }
      }
      throw error;
    }
  }
});
