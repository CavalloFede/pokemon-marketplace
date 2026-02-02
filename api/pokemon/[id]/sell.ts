import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { sellService } from '../../../apps/api/src/services/sell.service.js';

export default createHandler({
  // GET /api/pokemon/:id/sell - Get sell price preview
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Pokemon ID is required', 400);
      }

      const preview = await sellService.getSellPricePreview(auth.userId, id);
      return res.status(200).json(preview);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  },

  // POST /api/pokemon/:id/sell - Sell a pokemon
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Pokemon ID is required', 400);
      }

      const result = await sellService.sellPokemon(auth.userId, id);

      return res.status(200).json({
        success: true,
        coinsReceived: result.coinsReceived,
        newBalance: result.newBalance,
        soldPokemon: {
          speciesId: result.speciesId,
          speciesName: result.speciesName
        }
      });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      if (error instanceof Error) {
        if (error.message === 'Pokemon not found') {
          throw new ApiError(error.message, 404);
        }
        throw new ApiError(error.message, 400);
      }
      throw error;
    }
  }
});
