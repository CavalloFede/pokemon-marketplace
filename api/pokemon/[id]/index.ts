import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { pokemonService } from '../../../apps/api/src/services/pokemon.service.js';

export default createHandler({
  // GET /api/pokemon/:id - Get specific pokemon
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Pokemon ID is required', 400);
      }

      const pokemon = await pokemonService.getPokemonById(auth.userId, id);

      if (!pokemon) {
        throw new ApiError('Pokemon not found', 404);
      }

      return res.status(200).json(pokemon);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  },

  // PATCH /api/pokemon/:id - Update pokemon (nickname, favorite)
  PATCH: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Pokemon ID is required', 400);
      }

      const { nickname, isFavorite } = req.body || {};

      const pokemon = await pokemonService.updatePokemon(auth.userId, id, {
        nickname,
        isFavorite
      });

      return res.status(200).json(pokemon);
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
