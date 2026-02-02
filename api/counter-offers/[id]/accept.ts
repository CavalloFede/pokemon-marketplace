import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { counterOfferService } from '../../../apps/api/src/services/counter-offer.service.js';

export default createHandler({
  // POST /api/counter-offers/:id/accept - Accept counter-offer (listing owner)
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Counter-offer ID is required', 400);
      }

      const result = await counterOfferService.acceptCounterOffer(auth.userId, id);
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
