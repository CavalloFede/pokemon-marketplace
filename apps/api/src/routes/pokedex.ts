import { FastifyInstance } from 'fastify';

export async function pokedexRoutes(app: FastifyInstance) {
  // GET /pokedex - Get user's pokedex
  app.get('/', async (request, reply) => {
    // TODO: Implement get pokedex
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // GET /pokedex/stats - Get pokedex completion stats
  app.get('/stats', async (request, reply) => {
    // TODO: Implement get pokedex stats
    return reply.status(501).send({ error: 'Not implemented' });
  });
}
