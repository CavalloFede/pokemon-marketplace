import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { userService } from '../../../apps/api/src/services/user.service.js';
import { coinService } from '../../../apps/api/src/services/coin.service.js';

export default createHandler({
  // GET /api/users/me - Get current user profile
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);

      const user = await userService.getUserById(auth.userId);
      if (!user) {
        throw new ApiError('User not found', 404);
      }

      const stats = await userService.getUserStats(auth.userId);
      const dailyRewardStatus = await coinService.canClaimDailyReward(auth.userId);

      return res.status(200).json({
        ...user,
        stats,
        dailyReward: dailyRewardStatus
      });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  },

  // PATCH /api/users/me - Update current user profile
  PATCH: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);

      const { displayName, avatarUrl } = req.body || {};

      // Validate displayName
      if (displayName !== undefined) {
        if (displayName.length < 2 || displayName.length > 30) {
          throw new ApiError('Display name must be between 2 and 30 characters', 400);
        }
      }

      const user = await userService.updateProfile(auth.userId, {
        displayName,
        avatarUrl
      });

      return res.status(200).json(user);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  }
});
