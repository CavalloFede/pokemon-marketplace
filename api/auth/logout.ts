import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler } from '../../apps/api/src/utils/handler.js';
import { authService } from '../../apps/api/src/services/auth.service.js';

export default createHandler({
  POST: async (_req: VercelRequest, res: VercelResponse) => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, return success (client should clear local state)
    }
    return res.status(200).json({ success: true });
  }
});
