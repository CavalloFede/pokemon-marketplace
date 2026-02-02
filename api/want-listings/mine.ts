import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { wantListingService } from '../../apps/api/src/services/want-listing.service.js';

export default createHandler({
  // GET /api/want-listings/mine - Get user's own listings
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const listings = await wantListingService.getUserListings(auth.userId);
      return res.status(200).json(listings);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  }
});
