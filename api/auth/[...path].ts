import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authService } from '../../apps/api/src/services/auth.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';

  try {
    // POST /api/auth/authenticate
    if (path === 'authenticate' && req.method === 'POST') {
      const { idToken } = req.body || {};
      if (!idToken) {
        return res.status(400).json({ error: 'idToken is required' });
      }
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
    }

    // POST /api/auth/logout
    if (path === 'logout' && req.method === 'POST') {
      try {
        await authService.signOut();
      } catch {
        // Ignore logout errors
      }
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Auth error:', error);
    if (error instanceof Error) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
