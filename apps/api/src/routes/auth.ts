import { FastifyInstance } from 'fastify';
import { authService } from '../services/auth.service.js';

interface OAuthCallbackBody {
  code: string;
  redirectUri: string;
}

interface RefreshTokenBody {
  refreshToken: string;
}

export async function authRoutes(app: FastifyInstance) {
  // GET /auth/login-url - Get the login URL for Google OAuth
  app.get<{ Querystring: { redirectUri: string; state?: string } }>(
    '/login-url',
    async (request, reply) => {
      const { redirectUri, state } = request.query;

      if (!redirectUri) {
        return reply.status(400).send({ error: 'redirectUri is required' });
      }

      try {
        const loginUrl = authService.getLoginUrl(redirectUri, state);
        return { loginUrl };
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ error: 'Failed to generate login URL' });
      }
    }
  );

  // POST /auth/google/callback - Handle Google OAuth callback
  app.post<{ Body: OAuthCallbackBody }>(
    '/google/callback',
    async (request, reply) => {
      const { code, redirectUri } = request.body;

      if (!code || !redirectUri) {
        return reply.status(400).send({ error: 'code and redirectUri are required' });
      }

      try {
        const result = await authService.handleOAuthCallback(code, redirectUri);

        return {
          success: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            displayName: result.user.displayName,
            avatarUrl: result.user.avatarUrl,
            coins: result.user.coins
          },
          tokens: {
            accessToken: result.tokens.accessToken,
            idToken: result.tokens.idToken,
            refreshToken: result.tokens.refreshToken,
            expiresIn: result.tokens.expiresIn
          }
        };
      } catch (error) {
        app.log.error(error);
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Authentication failed' });
      }
    }
  );

  // POST /auth/refresh - Refresh access token
  app.post<{ Body: RefreshTokenBody }>(
    '/refresh',
    async (request, reply) => {
      const { refreshToken } = request.body;

      if (!refreshToken) {
        return reply.status(400).send({ error: 'refreshToken is required' });
      }

      try {
        const tokens = await authService.refreshTokens(refreshToken);

        return {
          success: true,
          tokens: {
            accessToken: tokens.accessToken,
            idToken: tokens.idToken,
            expiresIn: tokens.expiresIn
          }
        };
      } catch (error) {
        app.log.error(error);
        return reply.status(401).send({ error: 'Failed to refresh token' });
      }
    }
  );

  // POST /auth/logout - Logout user (invalidate tokens)
  app.post('/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'No token provided' });
    }

    const accessToken = authHeader.substring(7);

    try {
      await authService.signOut(accessToken);
      return { success: true };
    } catch (error) {
      app.log.error(error);
      // Even if logout fails, we return success (client should clear local tokens)
      return { success: true };
    }
  });
}
