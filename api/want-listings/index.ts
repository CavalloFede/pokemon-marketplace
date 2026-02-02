import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError, parseIntParam } from '../../apps/api/src/utils/handler.js';
import { requireAuth, optionalAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { wantListingService } from '../../apps/api/src/services/want-listing.service.js';

export default createHandler({
  // GET /api/want-listings - Get all open listings
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await optionalAuth(req);

      const result = await wantListingService.getListings({
        speciesId: parseIntParam(req.query.speciesId),
        minCoins: parseIntParam(req.query.minCoins),
        maxCoins: parseIntParam(req.query.maxCoins),
        page: parseIntParam(req.query.page, 1),
        pageSize: parseIntParam(req.query.pageSize, 20),
        excludeUserId: auth?.userId // Don't show user's own listings
      });

      return res.status(200).json(result);
    } catch (error) {
      throw error;
    }
  },

  // POST /api/want-listings - Create new listing
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);

      const listing = await wantListingService.createListing(auth.userId, req.body);

      return res.status(201).json(listing);
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
