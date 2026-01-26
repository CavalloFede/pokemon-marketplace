import { FastifyInstance } from 'fastify';

export async function shopRoutes(app: FastifyInstance) {
  // GET /shop/items - Get available shop items
  app.get('/items', async (request, reply) => {
    // TODO: Implement get shop items
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // POST /shop/purchase - Purchase an item
  app.post('/purchase', async (request, reply) => {
    // TODO: Implement purchase
    return reply.status(501).send({ error: 'Not implemented' });
  });
}
