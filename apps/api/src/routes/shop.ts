import { FastifyInstance } from 'fastify';
import { shopService } from '../services/shop.service.js';

interface PurchaseBody {
  itemId: string;
}

export async function shopRoutes(app: FastifyInstance) {
  // GET /shop/items - Get available shop items
  app.get('/items', async (request, reply) => {
    try {
      const items = await shopService.getShopItems();
      return items;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get shop items' });
    }
  });

  // POST /shop/purchase - Purchase an item
  app.post<{ Body: PurchaseBody }>('/purchase', async (request, reply) => {
    // TODO: Get userId from auth middleware
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { itemId } = request.body;

    if (!itemId) {
      return reply.status(400).send({ error: 'itemId is required' });
    }

    try {
      const result = await shopService.purchaseItem(userId, itemId);

      return {
        success: true,
        pokemon: result.pokemon,
        newBalance: result.newBalance,
        isNewPokedexEntry: result.isNewPokedexEntry,
        isShiny: result.isShiny,
        rolledRarity: result.rolledRarity
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Insufficient coins') {
          return reply.status(400).send({ error: error.message });
        }
        if (error.message === 'Item not available') {
          return reply.status(404).send({ error: error.message });
        }
      }

      app.log.error(error);
      return reply.status(500).send({ error: 'Purchase failed' });
    }
  });
}
