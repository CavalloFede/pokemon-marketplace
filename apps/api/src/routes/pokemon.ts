import { FastifyInstance } from 'fastify';
import { pokemonService } from '../services/pokemon.service.js';
import { sellService } from '../services/sell.service.js';
import { evolutionService } from '../services/evolution.service.js';

interface CollectionQuery {
  rarity?: string;
  types?: string;
  isInTeam?: string;
  isFavorite?: string;
  isShiny?: string;
  search?: string;
  sortBy?: 'name' | 'obtainedAt' | 'rarity' | 'speciesId';
  sortOrder?: 'asc' | 'desc';
  page?: string;
  pageSize?: string;
}

interface UpdateTeamBody {
  pokemonIds: string[];
}

interface UpdatePokemonBody {
  nickname?: string | null;
  isFavorite?: boolean;
}

export async function pokemonRoutes(app: FastifyInstance) {
  // GET /pokemon - Get user's pokemon collection
  app.get<{ Querystring: CollectionQuery }>('/', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query;

    try {
      const result = await pokemonService.getUserCollection(userId, {
        rarity: query.rarity?.split(','),
        types: query.types?.split(','),
        isInTeam: query.isInTeam === 'true' ? true : query.isInTeam === 'false' ? false : undefined,
        isFavorite: query.isFavorite === 'true' ? true : query.isFavorite === 'false' ? false : undefined,
        isShiny: query.isShiny === 'true' ? true : query.isShiny === 'false' ? false : undefined,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: query.page ? parseInt(query.page, 10) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined
      });

      return result;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get collection' });
    }
  });

  // GET /pokemon/team - Get user's team
  app.get('/team', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const team = await pokemonService.getUserTeam(userId);
      return { team };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get team' });
    }
  });

  // PUT /pokemon/team - Update user's team
  app.put<{ Body: UpdateTeamBody }>('/team', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { pokemonIds } = request.body;

    if (!Array.isArray(pokemonIds)) {
      return reply.status(400).send({ error: 'pokemonIds must be an array' });
    }

    try {
      const team = await pokemonService.updateTeam(userId, pokemonIds);
      return { team };
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to update team' });
    }
  });

  // GET /pokemon/:id - Get specific pokemon
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const pokemon = await pokemonService.getPokemonById(userId, id);

      if (!pokemon) {
        return reply.status(404).send({ error: 'Pokemon not found' });
      }

      return pokemon;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get pokemon' });
    }
  });

  // PATCH /pokemon/:id - Update pokemon (nickname, favorite)
  app.patch<{ Params: { id: string }; Body: UpdatePokemonBody }>(
    '/:id',
    async (request, reply) => {
      const userId = (request as any).userId;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;
      const { nickname, isFavorite } = request.body;

      try {
        const pokemon = await pokemonService.updatePokemon(userId, id, {
          nickname,
          isFavorite
        });

        return pokemon;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Pokemon not found') {
            return reply.status(404).send({ error: error.message });
          }
          return reply.status(400).send({ error: error.message });
        }
        app.log.error(error);
        return reply.status(500).send({ error: 'Failed to update pokemon' });
      }
    }
  );

  // GET /pokemon/:id/sell-preview - Get sell price preview
  app.get<{ Params: { id: string } }>('/:id/sell-preview', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const preview = await sellService.getSellPricePreview(userId, id);
      return preview;
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get sell preview' });
    }
  });

  // POST /pokemon/:id/sell - Sell a pokemon
  app.post<{ Params: { id: string } }>('/:id/sell', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const result = await sellService.sellPokemon(userId, id);

      return {
        success: true,
        coinsReceived: result.coinsReceived,
        newBalance: result.newBalance,
        soldPokemon: {
          speciesId: result.speciesId,
          speciesName: result.speciesName
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Pokemon not found') {
          return reply.status(404).send({ error: error.message });
        }
        return reply.status(400).send({ error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to sell pokemon' });
    }
  });

  // GET /pokemon/evolution-ready - Get all Pokemon ready to evolve
  app.get('/evolution-ready', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const readyPokemon = await evolutionService.getEvolutionReadyPokemon(userId);
      return { pokemon: readyPokemon };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to get evolution-ready pokemon' });
    }
  });

  // POST /pokemon/:id/evolve - Evolve a Pokemon
  app.post<{ Params: { id: string } }>('/:id/evolve', async (request, reply) => {
    const userId = (request as any).userId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const result = await evolutionService.evolvePokemon(userId, id);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Pokemon not found') {
          return reply.status(404).send({ error: error.message });
        }
        return reply.status(400).send({ error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to evolve pokemon' });
    }
  });

  // PATCH /pokemon/:id/evolution-settings - Update evolution notification settings
  app.patch<{ Params: { id: string }; Body: { suppressNotification: boolean } }>(
    '/:id/evolution-settings',
    async (request, reply) => {
      const userId = (request as any).userId;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;
      const { suppressNotification } = request.body;

      if (typeof suppressNotification !== 'boolean') {
        return reply.status(400).send({ error: 'suppressNotification must be a boolean' });
      }

      try {
        await evolutionService.updateEvolutionSettings(userId, id, suppressNotification);
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Pokemon not found') {
            return reply.status(404).send({ error: error.message });
          }
          return reply.status(400).send({ error: error.message });
        }
        app.log.error(error);
        return reply.status(500).send({ error: 'Failed to update evolution settings' });
      }
    }
  );
}
