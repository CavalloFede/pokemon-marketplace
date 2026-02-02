import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, optionalAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { wantListingService } from '../../../apps/api/src/services/want-listing.service.js';

export default createHandler({
  // GET /api/want-listings/:id - Get single listing details
  GET: async (req: VercelRequest, res: VercelResponse) => {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new ApiError('Listing ID is required', 400);
    }

    const listing = await wantListingService.getListing(id);

    if (!listing) {
      throw new ApiError('Listing not found', 404);
    }

    return res.status(200).json(listing);
  },

  // PATCH /api/want-listings/:id - Update listing
  PATCH: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Listing ID is required', 400);
      }

      const listing = await wantListingService.updateListing(auth.userId, id, req.body);
      return res.status(200).json(listing);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      if (error instanceof Error) {
        throw new ApiError(error.message, 400);
      }
      throw error;
    }
  },

  // DELETE /api/want-listings/:id - Cancel listing
  DELETE: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Listing ID is required', 400);
      }

      await wantListingService.cancelListing(auth.userId, id);
      return res.status(200).json({ success: true });
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
