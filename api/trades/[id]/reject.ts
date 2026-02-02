import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { tradeService } from '../../../apps/api/src/services/trade.service.js';

export default createHandler({
  // POST /api/trades/:id/reject - Reject a trade
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Trade ID is required', 400);
      }

      const trade = await tradeService.rejectTrade(id, auth.userId);
      return res.status(200).json({ success: true, trade });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      if (error instanceof Error) {
        if (error.message === 'Trade not found') {
          throw new ApiError(error.message, 404);
        }
        throw new ApiError(error.message, 400);
      }
      throw error;
    }
  }
});
