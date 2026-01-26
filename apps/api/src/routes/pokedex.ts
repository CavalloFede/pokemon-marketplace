import { FastifyInstance } from 'fastify';
import { pokedexService } from '../services/pokedex.service.js';

interface PokedexQuery {
  generation?: string;
  types?: string;
  obtained?: string;
  search?: string;
  page?: string;
  pageSize?: string;
}

export async function pokedexRoutes(app: FastifyInstance) {
  // GET /pokedex - Get user's pokedex
  app.get<{ Querystring: PokedexQuery }>('/', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query;

    try {
      const result = await pokedexService.getUserPokedex(userId, {
        generation: query.generation ? parseInt(query.generation, 10) : undefined,
        types: query.types?.split(','),
        obtained: query.obtained === 'true' ? true : query.obtained === 'false' ? false : undefined,
        search: query.search,
        page: query.page ? parseInt(query.page, 10) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined
      });

      return result;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get pokedex' });
    }
  });

  // GET /pokedex/stats - Get pokedex completion stats
  app.get('/stats', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const stats = await pokedexService.getPokedexStats(userId);
      return stats;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get pokedex stats' });
    }
  });
}
