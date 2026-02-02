import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { authService } from '../../apps/api/src/services/auth.service.js';

export default createHandler({
  POST: async (req: VercelRequest, res: VercelResponse) => {
    const { idToken } = req.body || {};

    if (!idToken) {
      throw new ApiError('idToken is required', 400);
    }

    try {
      const result = await authService.authenticate(idToken);

      return res.status(200).json({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
          avatarUrl: result.user.avatarUrl,
          coins: result.user.coins
        }
      });
    } catch (error) {
      console.error('Authentication error:', error);
      if (error instanceof Error) {
        throw new ApiError(error.message, 401);
      }
      throw new ApiError('Authentication failed', 500);
    }
  }
});
