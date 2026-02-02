import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHandler, ApiError, parseQueryParam, parseIntParam } from '../../apps/api/src/utils/handler.js';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { tradeService } from '../../apps/api/src/services/trade.service.js';
import { TradeStatus } from '@pokemon-marketplace/shared';

export default createHandler({
  // GET /api/trades - Get user's trades
  GET: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);

      const result = await tradeService.getUserTrades(auth.userId, {
        status: parseQueryParam(req.query.status)?.split(',') as TradeStatus[],
        role: parseQueryParam(req.query.role) as 'initiator' | 'receiver' | 'all' | undefined,
        page: parseIntParam(req.query.page),
        pageSize: parseIntParam(req.query.pageSize)
      });

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      throw error;
    }
  },

  // POST /api/trades - Create a trade offer
  POST: async (req: VercelRequest, res: VercelResponse) => {
    try {
      const auth = await requireAuth(req);
      const body = req.body || {};

      // Validation
      if (!body.receiverId) {
        throw new ApiError('receiverId is required', 400);
      }
      if (!Array.isArray(body.initiatorPokemonIds) || body.initiatorPokemonIds.length === 0) {
        throw new ApiError('initiatorPokemonIds must be a non-empty array', 400);
      }
      if (!Array.isArray(body.receiverPokemonIds) || body.receiverPokemonIds.length === 0) {
        throw new ApiError('receiverPokemonIds must be a non-empty array', 400);
      }
      if (body.initiatorPokemonIds.length > 6 || body.receiverPokemonIds.length > 6) {
        throw new ApiError('Cannot trade more than 6 Pokemon at once', 400);
      }

      const trade = await tradeService.createTrade(auth.userId, {
        receiverId: body.receiverId,
        initiatorPokemonIds: body.initiatorPokemonIds,
        receiverPokemonIds: body.receiverPokemonIds,
        coinsOffered: body.coinsOffered,
        message: body.message
      });

      return res.status(201).json({ success: true, trade });
    } catch (error) {
      if (error instanceof AuthError) {
        throw new ApiError(error.message, error.statusCode);
      }
      if (error instanceof Error) {
        throw new ApiError(error.message, 400);
      }
      throw error;
    }
  }
});
