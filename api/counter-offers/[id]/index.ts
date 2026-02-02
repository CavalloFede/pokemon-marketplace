import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { counterOfferService } from '../../../apps/api/src/services/counter-offer.service.js';

export default createHandler({
  // GET /api/counter-offers/:id - Get single counter-offer
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Counter-offer ID is required', 400);
      }

      const counterOffer = await counterOfferService.getCounterOffer(id);

      if (!counterOffer) {
        throw new ApiError('Counter-offer not found', 404);
      }

      return res.status(200).json(counterOffer);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  },

  // DELETE /api/counter-offers/:id - Withdraw counter-offer (counter-offer creator)
  DELETE: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Counter-offer ID is required', 400);
      }

      await counterOfferService.withdrawCounterOffer(auth.userId, id);
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
