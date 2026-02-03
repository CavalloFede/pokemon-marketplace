import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { userService } from '../../apps/api/src/services/user.service.js';
import { coinService } from '../../apps/api/src/services/coin.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ''];
  const path = pathParts.join('/');

  try {
    // GET /api/users/me
    if (path === 'me' && req.method === 'GET') {
      const auth = await requireAuth(req);
      const user = await userService.getUserById(auth.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const stats = await userService.getUserStats(auth.userId);
      const dailyRewardStatus = await coinService.canClaimDailyReward(auth.userId);
      return res.status(200).json({ ...user, stats, dailyReward: dailyRewardStatus });
    }

    // PATCH /api/users/me
    if (path === 'me' && req.method === 'PATCH') {
      const auth = await requireAuth(req);
      const { displayName, avatarUrl } = req.body || {};
      if (displayName !== undefined && (displayName.length < 2 || displayName.length > 30)) {
        return res.status(400).json({ error: 'Display name must be between 2 and 30 characters' });
      }
      const user = await userService.updateProfile(auth.userId, { displayName, avatarUrl });
      return res.status(200).json(user);
    }

    // GET /api/users/me/daily-reward
    if (path === 'me/daily-reward' && req.method === 'GET') {
      const auth = await requireAuth(req);
      const status = await coinService.canClaimDailyReward(auth.userId);
      return res.status(200).json(status);
    }

    // POST /api/users/me/daily-reward
    if (path === 'me/daily-reward' && req.method === 'POST') {
      const auth = await requireAuth(req);
      try {
        const result = await coinService.claimDailyReward(auth.userId);
        return res.status(200).json({ success: true, ...result });
      } catch (error) {
        if (error instanceof Error && error.message === 'Daily reward already claimed') {
          return res.status(400).json({ error: error.message });
        }
        throw error;
      }
    }

    // GET /api/users/:id (public profile)
    if (pathParts.length === 1 && pathParts[0] !== 'me' && req.method === 'GET') {
      const profile = await userService.getPublicProfile(pathParts[0]);
      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json(profile);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Users error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
