import { FastifyInstance } from 'fastify';

export async function pokemonRoutes(app: FastifyInstance) {
  // GET /pokemon - Get user's pokemon collection
  app.get('/', async (request, reply) => {
    // TODO: Implement get collection
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // GET /pokemon/team - Get user's team
  app.get('/team', async (request, reply) => {
    // TODO: Implement get team
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // PUT /pokemon/team - Update user's team
  app.put('/team', async (request, reply) => {
    // TODO: Implement update team
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // GET /pokemon/:id - Get specific pokemon
  app.get('/:id', async (request, reply) => {
    // TODO: Implement get pokemon
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // PATCH /pokemon/:id - Update pokemon (nickname, favorite)
  app.patch('/:id', async (request, reply) => {
    // TODO: Implement update pokemon
    return reply.status(501).send({ error: 'Not implemented' });
  });
}
