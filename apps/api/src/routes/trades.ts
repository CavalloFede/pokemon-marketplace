import { FastifyInstance } from 'fastify';
import { tradeService } from '../services/trade.service.js';
import { TradeStatus } from '@pokemon-marketplace/shared';

interface TradesQuery {
  status?: string;
  role?: 'initiator' | 'receiver' | 'all';
  page?: string;
  pageSize?: string;
}

interface CreateTradeBody {
  receiverId: string;
  initiatorPokemonIds: string[];
  receiverPokemonIds: string[];
  coinsOffered?: number;
  message?: string;
}

export async function tradeRoutes(app: FastifyInstance) {
  // GET /trades - Get user's trades
  app.get<{ Querystring: TradesQuery }>('/', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query;

    try {
      const result = await tradeService.getUserTrades(userId, {
        status: query.status?.split(',') as TradeStatus[],
        role: query.role,
        page: query.page ? parseInt(query.page, 10) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined
      });

      return result;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get trades' });
    }
  });

  // POST /trades - Create a trade offer
  app.post<{ Body: CreateTradeBody }>('/', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body;

    // Validation
    if (!body.receiverId) {
      return reply.status(400).send({ error: 'receiverId is required' });
    }
    if (!Array.isArray(body.initiatorPokemonIds) || body.initiatorPokemonIds.length === 0) {
      return reply.status(400).send({ error: 'initiatorPokemonIds must be a non-empty array' });
    }
    if (!Array.isArray(body.receiverPokemonIds) || body.receiverPokemonIds.length === 0) {
      return reply.status(400).send({ error: 'receiverPokemonIds must be a non-empty array' });
    }
    if (body.initiatorPokemonIds.length > 6 || body.receiverPokemonIds.length > 6) {
      return reply.status(400).send({ error: 'Cannot trade more than 6 Pokemon at once' });
    }

    try {
      const trade = await tradeService.createTrade(userId, {
        receiverId: body.receiverId,
        initiatorPokemonIds: body.initiatorPokemonIds,
        receiverPokemonIds: body.receiverPokemonIds,
        coinsOffered: body.coinsOffered,
        message: body.message
      });

      return { success: true, trade };
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to create trade' });
    }
  });

  // GET /trades/:id - Get trade details
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const trade = await tradeService.getTradeById(id);

      if (!trade) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Check if user is part of this trade
      if (trade.initiatorId !== userId && trade.receiverId !== userId) {
        return reply.status(403).send({ error: 'Not authorized to view this trade' });
      }

      return trade;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get trade' });
    }
  });

  // POST /trades/:id/accept - Accept a trade
  app.post<{ Params: { id: string } }>('/:id/accept', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const trade = await tradeService.acceptTrade(id, userId);
      return { success: true, trade };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Trade not found') {
          return reply.status(404).send({ error: error.message });
        }
        return reply.status(400).send({ error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to accept trade' });
    }
  });

  // POST /trades/:id/reject - Reject a trade
  app.post<{ Params: { id: string } }>('/:id/reject', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const trade = await tradeService.rejectTrade(id, userId);
      return { success: true, trade };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Trade not found') {
          return reply.status(404).send({ error: error.message });
        }
        return reply.status(400).send({ error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to reject trade' });
    }
  });

  // POST /trades/:id/cancel - Cancel a trade
  app.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const trade = await tradeService.cancelTrade(id, userId);
      return { success: true, trade };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Trade not found') {
          return reply.status(404).send({ error: error.message });
        }
        return reply.status(400).send({ error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to cancel trade' });
    }
  });
}
