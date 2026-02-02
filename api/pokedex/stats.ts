import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { pokedexService } from '../../apps/api/src/services/pokedex.service.js';

export default createHandler({
  // GET /api/pokedex/stats - Get pokedex completion stats
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const stats = await pokedexService.getPokedexStats(auth.userId);
      return res.status(200).json(stats);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  }
});
