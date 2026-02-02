import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { tradeService } from '../../../apps/api/src/services/trade.service.js';

export default createHandler({
  // GET /api/trades/:id - Get trade details
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Trade ID is required', 400);
      }

      const trade = await tradeService.getTradeById(id);

      if (!trade) {
        throw new ApiError('Trade not found', 404);
      }

      // Check if user is part of this trade
      if (trade.initiatorId !== auth.userId && trade.receiverId !== auth.userId) {
        throw new ApiError('Not authorized to view this trade', 403);
      }

      return res.status(200).json(trade);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  }
});
