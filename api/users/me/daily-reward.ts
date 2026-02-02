import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { coinService } from '../../../apps/api/src/services/coin.service.js';

export default createHandler({
  // GET /api/users/me/daily-reward - Check daily reward status
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const status = await coinService.canClaimDailyReward(auth.userId);
      return res.status(200).json(status);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  },

  // POST /api/users/me/daily-reward - Claim daily reward
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const result = await coinService.claimDailyReward(auth.userId);

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      if (error instanceof Error) {
        if (error.message === 'Daily reward already claimed') {
          throw new ApiError(error.message, 400);
        }
      }
      throw error;
    }
  }
});
