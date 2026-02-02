import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError, parseQueryParam, parseIntParam, parseBoolParam } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { pokedexService } from '../../apps/api/src/services/pokedex.service.js';

export default createHandler({
  // GET /api/pokedex - Get user's pokedex
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);

      const result = await pokedexService.getUserPokedex(auth.userId, {
        generation: parseIntParam(req.query.generation),
        types: parseQueryParam(req.query.types)?.split(','),
        obtained: parseBoolParam(req.query.obtained),
        search: parseQueryParam(req.query.search),
        page: parseIntParam(req.query.page),
        pageSize: parseIntParam(req.query.pageSize)
      });

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  }
});
