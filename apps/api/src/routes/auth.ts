import { FastifyInstance } from 'fastify';
import { authService } from '../services/auth.service.js';

interface AuthenticateBody {
  idToken: string;
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/authenticate - Verify Firebase ID token and authenticate user
  app.post<{ Body: AuthenticateBody }>(
    '/authenticate',
    async (request, reply) => {
      const { idToken } = request.body;

      if (!idToken) {
        return reply.status(400).send({ error: 'idToken is required' });
      }

      try {
        const result = await authService.authenticate(idToken);

        return {
          success: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            displayName: result.user.displayName,
            avatarUrl: result.user.avatarUrl,
            coins: result.user.coins
          }
        };
      } catch (error) {
        app.log.error(error);
        if (error instanceof Error) {
          return reply.status(401).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Authentication failed' });
      }
    }
  );

  // POST /auth/logout - Logout user
  app.post('/logout', async (_request, reply) => {
    try {
      await authService.signOut();
      return { success: true };
    } catch (error) {
      app.log.error(error);
      // Even if logout fails, we return success (client should clear local state)
      return { success: true };
    }
  });
}
