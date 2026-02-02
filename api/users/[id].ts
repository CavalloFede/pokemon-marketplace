import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError } from '../../apps/api/src/utils/handler.js';
import { userService } from '../../apps/api/src/services/user.service.js';

export default createHandler({
  // GET /api/users/:id - Get public user profile
  GET: async (req: VercelRequest, res: VercelResponse) => {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      throw new ApiError('User ID is required', 400);
    }

    const profile = await userService.getPublicProfile(id);

    if (!profile) {
      throw new ApiError('User not found', 404);
    }

    return res.status(200).json(profile);
  }
});
