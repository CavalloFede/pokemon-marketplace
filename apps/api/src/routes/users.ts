import { FastifyInstance } from 'fastify';

export async function userRoutes(app: FastifyInstance) {
  // GET /users/me - Get current user profile
  app.get('/me', async (request, reply) => {
    // TODO: Implement get current user
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // PATCH /users/me - Update current user profile
  app.patch('/me', async (request, reply) => {
    // TODO: Implement update profile
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // POST /users/me/daily-reward - Claim daily reward
  app.post('/me/daily-reward', async (request, reply) => {
    // TODO: Implement daily reward claim
    return reply.status(501).send({ error: 'Not implemented' });
  });

  // GET /users/:id - Get public user profile
  app.get('/:id', async (request, reply) => {
    // TODO: Implement get public profile
    return reply.status(501).send({ error: 'Not implemented' });
  });
}
