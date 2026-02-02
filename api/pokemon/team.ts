import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { pokemonService } from '../../apps/api/src/services/pokemon.service.js';

export default createHandler({
  // GET /api/pokemon/team - Get user's team
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const team = await pokemonService.getUserTeam(auth.userId);
      return res.status(200).json({ team });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  },

  // PUT /api/pokemon/team - Update user's team
  PUT: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { pokemonIds } = req.body || {};

      if (!Array.isArray(pokemonIds)) {
        throw new ApiError('pokemonIds must be an array', 400);
      }

      const team = await pokemonService.updateTeam(auth.userId, pokemonIds);
      return res.status(200).json({ team });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      if (error instanceof Error) {
        throw new ApiError(error.message, 400);
      }
      throw error;
    }
  }
});
