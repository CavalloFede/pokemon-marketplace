import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError, parseQueryParam, parseIntParam, parseBoolParam } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { pokemonService } from '../../apps/api/src/services/pokemon.service.js';

export default createHandler({
  // GET /api/pokemon - Get user's pokemon collection
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);

      const result = await pokemonService.getUserCollection(auth.userId, {
        rarity: parseQueryParam(req.query.rarity)?.split(','),
        types: parseQueryParam(req.query.types)?.split(','),
        isInTeam: parseBoolParam(req.query.isInTeam),
        isFavorite: parseBoolParam(req.query.isFavorite),
        isShiny: parseBoolParam(req.query.isShiny),
        search: parseQueryParam(req.query.search),
        sortBy: parseQueryParam(req.query.sortBy) as 'name' | 'obtainedAt' | 'rarity' | 'speciesId' | undefined,
        sortOrder: parseQueryParam(req.query.sortOrder) as 'asc' | 'desc' | undefined,
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
