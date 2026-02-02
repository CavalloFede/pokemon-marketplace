import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { evolutionService } from '../../../apps/api/src/services/evolution.service.js';

export default createHandler({
  // POST /api/pokemon/:id/evolve - Evolve a Pokemon
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Pokemon ID is required', 400);
      }

      const result = await evolutionService.evolvePokemon(auth.userId, id);
      return res.status(200).json(result);
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
