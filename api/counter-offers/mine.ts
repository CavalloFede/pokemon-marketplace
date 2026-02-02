import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { counterOfferService } from '../../apps/api/src/services/counter-offer.service.js';

export default createHandler({
  // GET /api/counter-offers/mine - Get user's counter-offers
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const counterOffers = await counterOfferService.getUserCounterOffers(auth.userId);
      return res.status(200).json(counterOffers);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  }
});
