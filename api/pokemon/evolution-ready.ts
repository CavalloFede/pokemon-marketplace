import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { evolutionService } from '../../apps/api/src/services/evolution.service.js';

export default createHandler({
  // GET /api/pokemon/evolution-ready - Get all Pokemon ready to evolve
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const readyPokemon = await evolutionService.getEvolutionReadyPokemon(auth.userId);
      return res.status(200).json({ pokemon: readyPokemon });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  }
});
