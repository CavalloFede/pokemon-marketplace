import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { counterOfferService } from '../services/counter-offer.service.js';

interface CreateCounterOfferBody {
  wantListingId: string;
  offeredPokemonIds: string[];
  coinsRequested: number;
  requestedPokemonIds: string[];
  message?: string;
}

export async function counterOffersRoutes(app: FastifyInstance) {
  // Create counter-offer
  app.post<{ Body: CreateCounterOfferBody }>(
    '/',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const counterOffer = await counterOfferService.createCounterOffer(
          request.userId,
          request.body
        );

        return reply.status(201).send(counterOffer);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get user's counter-offers
  app.get(
    '/mine',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const counterOffers = await counterOfferService.getUserCounterOffers(
          request.userId
        );

        return reply.send(counterOffers);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch counter-offers' });
      }
    }
  );

  // Get single counter-offer
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const counterOffer = await counterOfferService.getCounterOffer(
          request.params.id
        );

        if (!counterOffer) {
          return reply.status(404).send({ error: 'Counter-offer not found' });
        }

        return reply.send(counterOffer);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch counter-offer' });
      }
    }
  );

  // Accept counter-offer (listing owner)
  app.post<{ Params: { id: string } }>(
    '/:id/accept',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const result = await counterOfferService.acceptCounterOffer(
          request.userId,
          request.params.id
        );

        return reply.send(result);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Reject counter-offer (listing owner)
  app.post<{ Params: { id: string } }>(
    '/:id/reject',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        await counterOfferService.rejectCounterOffer(
          request.userId,
          request.params.id
        );

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Withdraw counter-offer (counter-offer creator)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        await counterOfferService.withdrawCounterOffer(
          request.userId,
          request.params.id
        );

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );
}
