import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { counterOfferService } from '../../apps/api/src/services/counter-offer.service.js';

export default createHandler({
  // POST /api/counter-offers - Create counter-offer
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);

      const counterOffer = await counterOfferService.createCounterOffer(auth.userId, req.body);

      return res.status(201).json(counterOffer);
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
