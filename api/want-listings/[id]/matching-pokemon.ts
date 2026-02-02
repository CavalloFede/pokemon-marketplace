import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { wantListingService } from '../../../apps/api/src/services/want-listing.service.js';

export default createHandler({
  // GET /api/want-listings/:id/matching-pokemon - Find matching Pokemon for a listing
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Listing ID is required', 400);
      }

      const pokemon = await wantListingService.findMatchingPokemon(id, auth.userId);
      return res.status(200).json(pokemon);
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
