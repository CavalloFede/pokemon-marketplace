import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { wantListingService } from '../../../apps/api/src/services/want-listing.service.js';

export default createHandler({
  // POST /api/want-listings/:id/accept - Accept listing directly
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Listing ID is required', 400);
      }

      const { pokemonId } = req.body || {};

      if (!pokemonId) {
        throw new ApiError('pokemonId is required', 400);
      }

      const result = await wantListingService.acceptListing(auth.userId, id, pokemonId);
      return res.status(200).json(result);
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
