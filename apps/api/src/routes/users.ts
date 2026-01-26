import { FastifyInstance } from 'fastify';
import { userService } from '../services/user.service.js';
import { coinService } from '../services/coin.service.js';

interface UpdateProfileBody {
  displayName?: string;
  avatarUrl?: string | null;
}

export async function userRoutes(app: FastifyInstance) {
  // GET /users/me - Get current user profile
  app.get('/me', async (request, reply) => {
    // TODO: Get userId from auth middleware
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const user = await userService.getUserById(userId);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const stats = await userService.getUserStats(userId);
      const dailyRewardStatus = await coinService.canClaimDailyReward(userId);

      return {
        ...user,
        stats,
        dailyReward: dailyRewardStatus
      };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get user' });
    }
  });

  // PATCH /users/me - Update current user profile
  app.patch<{ Body: UpdateProfileBody }>('/me', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { displayName, avatarUrl } = request.body;

    // Validate displayName
    if (displayName !== undefined) {
      if (displayName.length < 2 || displayName.length > 30) {
        return reply.status(400).send({
          error: 'Display name must be between 2 and 30 characters'
        });
      }
    }

    try {
      const user = await userService.updateProfile(userId, {
        displayName,
        avatarUrl
      });

      return user;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to update profile' });
    }
  });

  // POST /users/me/daily-reward - Claim daily reward
  app.post('/me/daily-reward', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const result = await coinService.claimDailyReward(userId);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Daily reward already claimed') {
          return reply.status(400).send({ error: error.message });
        }
      }

      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to claim reward' });
    }
  });

  // GET /users/me/daily-reward - Check daily reward status
  app.get('/me/daily-reward', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const status = await coinService.canClaimDailyReward(userId);
      return status;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to check reward status' });
    }
  });

  // GET /users/:id - Get public user profile
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const profile = await userService.getPublicProfile(id);

      if (!profile) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return profile;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get profile' });
    }
  });
}
