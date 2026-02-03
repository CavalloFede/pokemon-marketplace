import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { tradeService } from '../../apps/api/src/services/trade.service.js';
import { TradeStatus } from '@pokemon-marketplace/shared';

function parseQueryParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(value: string | string[] | undefined): number | undefined {
  const str = parseQueryParam(value);
  if (!str) return undefined;
  const num = parseInt(str, 10);
  return isNaN(num) ? undefined : num;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ''];
  const path = pathParts.join('/');

  try {
    const auth = await requireAuth(req);

    // GET /api/trades
    if ((path === '' || pathParts[0] === '') && req.method === 'GET') {
      const result = await tradeService.getUserTrades(auth.userId, {
        status: parseQueryParam(req.query.status)?.split(',') as TradeStatus[],
        role: parseQueryParam(req.query.role) as 'initiator' | 'receiver' | 'all' | undefined,
        page: parseIntParam(req.query.page),
        pageSize: parseIntParam(req.query.pageSize)
      });
      return res.status(200).json(result);
    }

    // POST /api/trades
    if ((path === '' || pathParts[0] === '') && req.method === 'POST') {
      const body = req.body || {};
      if (!body.receiverId) {
        return res.status(400).json({ error: 'receiverId is required' });
      }
      if (!Array.isArray(body.initiatorPokemonIds) || body.initiatorPokemonIds.length === 0) {
        return res.status(400).json({ error: 'initiatorPokemonIds must be a non-empty array' });
      }
      if (!Array.isArray(body.receiverPokemonIds) || body.receiverPokemonIds.length === 0) {
        return res.status(400).json({ error: 'receiverPokemonIds must be a non-empty array' });
      }
      if (body.initiatorPokemonIds.length > 6 || body.receiverPokemonIds.length > 6) {
        return res.status(400).json({ error: 'Cannot trade more than 6 Pokemon at once' });
      }
      const trade = await tradeService.createTrade(auth.userId, body);
      return res.status(201).json({ success: true, trade });
    }

    // Routes with trade ID: /api/trades/:id/...
    if (pathParts.length >= 1 && pathParts[0] !== '') {
      const tradeId = pathParts[0];

      // GET /api/trades/:id
      if (pathParts.length === 1 && req.method === 'GET') {
        const trade = await tradeService.getTradeById(tradeId);
        if (!trade) {
          return res.status(404).json({ error: 'Trade not found' });
        }
        if (trade.initiatorId !== auth.userId && trade.receiverId !== auth.userId) {
          return res.status(403).json({ error: 'Not authorized to view this trade' });
        }
        return res.status(200).json(trade);
      }

      // POST /api/trades/:id/accept
      if (pathParts[1] === 'accept' && req.method === 'POST') {
        const trade = await tradeService.acceptTrade(tradeId, auth.userId);
        return res.status(200).json({ success: true, trade });
      }

      // POST /api/trades/:id/reject
      if (pathParts[1] === 'reject' && req.method === 'POST') {
        const trade = await tradeService.rejectTrade(tradeId, auth.userId);
        return res.status(200).json({ success: true, trade });
      }

      // POST /api/trades/:id/cancel
      if (pathParts[1] === 'cancel' && req.method === 'POST') {
        const trade = await tradeService.cancelTrade(tradeId, auth.userId);
        return res.status(200).json({ success: true, trade });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Trades error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      if (error.message === 'Trade not found') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
