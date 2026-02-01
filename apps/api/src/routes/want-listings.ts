import { FastifyInstance } from 'fastify';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { wantListingService } from '../services/want-listing.service.js';

interface CreateListingBody {
  wantedSpeciesId: number;
  wantShiny?: boolean;
  coinsOffered: number;
  offeredPokemonIds: string[];
  expiresInDays?: number;
}

interface UpdateListingBody {
  coinsOffered?: number;
  offeredPokemonIds?: string[];
}

interface AcceptListingBody {
  pokemonId: string;
}

interface GetListingsQuery {
  speciesId?: string;
  minCoins?: string;
  maxCoins?: string;
  page?: string;
  pageSize?: string;
}

export async function wantListingsRoutes(app: FastifyInstance) {
  // Create new listing
  app.post<{ Body: CreateListingBody }>(
    '/',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const listing = await wantListingService.createListing(
          request.userId,
          request.body
        );

        return reply.status(201).send(listing);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get all open listings
  app.get<{ Querystring: GetListingsQuery }>(
    '/',
    { preHandler: optionalAuthMiddleware },
    async (request, reply) => {
      try {
        const {
          speciesId,
          minCoins,
          maxCoins,
          page,
          pageSize
        } = request.query;

        const result = await wantListingService.getListings({
          speciesId: speciesId ? parseInt(speciesId) : undefined,
          minCoins: minCoins ? parseInt(minCoins) : undefined,
          maxCoins: maxCoins ? parseInt(maxCoins) : undefined,
          page: page ? parseInt(page) : 1,
          pageSize: pageSize ? parseInt(pageSize) : 20,
          excludeUserId: request.userId // Don't show user's own listings
        });

        return reply.send(result);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch listings' });
      }
    }
  );

  // Get user's own listings
  app.get(
    '/mine',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const listings = await wantListingService.getUserListings(request.userId);
        return reply.send(listings);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch listings' });
      }
    }
  );

  // Get single listing details
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: optionalAuthMiddleware },
    async (request, reply) => {
      try {
        const listing = await wantListingService.getListing(request.params.id);

        if (!listing) {
          return reply.status(404).send({ error: 'Listing not found' });
        }

        return reply.send(listing);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch listing' });
      }
    }
  );

  // Update listing
  app.patch<{ Params: { id: string }; Body: UpdateListingBody }>(
    '/:id',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const listing = await wantListingService.updateListing(
          request.userId,
          request.params.id,
          request.body
        );

        return reply.send(listing);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Cancel listing
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        await wantListingService.cancelListing(
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

  // Accept listing directly
  app.post<{ Params: { id: string }; Body: AcceptListingBody }>(
    '/:id/accept',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const result = await wantListingService.acceptListing(
          request.userId,
          request.params.id,
          request.body.pokemonId
        );

        return reply.send(result);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Find matching Pokemon for a listing
  app.get<{ Params: { id: string } }>(
    '/:id/matching-pokemon',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        if (!request.userId) {
          return reply.status(401).send({ error: 'Not authenticated' });
        }

        const pokemon = await wantListingService.findMatchingPokemon(
          request.params.id,
          request.userId
        );

        return reply.send(pokemon);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );
}
