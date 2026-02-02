import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../../apps/api/src/utils/auth.js';
import { evolutionService } from '../../../apps/api/src/services/evolution.service.js';

export default createHandler({
  // PATCH /api/pokemon/:id/evolution-settings - Update evolution notification settings
  PATCH: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        throw new ApiError('Pokemon ID is required', 400);
      }

      const { suppressNotification } = req.body || {};

      if (typeof suppressNotification !== 'boolean') {
        throw new ApiError('suppressNotification must be a boolean', 400);
      }

      await evolutionService.updateEvolutionSettings(auth.userId, id, suppressNotification);
      return res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      if (error instanceof Error) {
        if (error.message === 'Pokemon not found') {
          throw new ApiError(error.message, 404);
        }
        throw new ApiError(error.message, 400);
      }
      throw error;
    }
  }
});
