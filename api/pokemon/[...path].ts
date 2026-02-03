import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { pokemonService } from '../../apps/api/src/services/pokemon.service.js';
import { sellService } from '../../apps/api/src/services/sell.service.js';
import { evolutionService } from '../../apps/api/src/services/evolution.service.js';

function parseQueryParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(value: string | string[] | undefined): number | undefined {
  const str = parseQueryParam(value);
  if (!str) return undefined;
  const num = parseInt(str, 10);
  return isNaN(num) ? undefined : num;
}

function parseBoolParam(value: string | string[] | undefined): boolean | undefined {
  const str = parseQueryParam(value);
  if (str === 'true') return true;
  if (str === 'false') return false;
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ''];
  const path = pathParts.join('/');

  try {
    const auth = await requireAuth(req);

    // GET /api/pokemon (collection)
    if (pathParts.length === 1 && pathParts[0] === '' && req.method === 'GET') {
      const result = await pokemonService.getUserCollection(auth.userId, {
        rarity: parseQueryParam(req.query.rarity)?.split(','),
        types: parseQueryParam(req.query.types)?.split(','),
        isInTeam: parseBoolParam(req.query.isInTeam),
        isFavorite: parseBoolParam(req.query.isFavorite),
        isShiny: parseBoolParam(req.query.isShiny),
        search: parseQueryParam(req.query.search),
        sortBy: parseQueryParam(req.query.sortBy) as any,
        sortOrder: parseQueryParam(req.query.sortOrder) as any,
        page: parseIntParam(req.query.page),
        pageSize: parseIntParam(req.query.pageSize)
      });
      return res.status(200).json(result);
    }

    // GET /api/pokemon/team
    if (path === 'team' && req.method === 'GET') {
      const team = await pokemonService.getUserTeam(auth.userId);
      return res.status(200).json({ team });
    }

    // PUT /api/pokemon/team
    if (path === 'team' && req.method === 'PUT') {
      const { pokemonIds } = req.body || {};
      if (!Array.isArray(pokemonIds)) {
        return res.status(400).json({ error: 'pokemonIds must be an array' });
      }
      const team = await pokemonService.updateTeam(auth.userId, pokemonIds);
      return res.status(200).json({ team });
    }

    // GET /api/pokemon/evolution-ready
    if (path === 'evolution-ready' && req.method === 'GET') {
      const readyPokemon = await evolutionService.getEvolutionReadyPokemon(auth.userId);
      return res.status(200).json({ pokemon: readyPokemon });
    }

    // Routes with pokemon ID: /api/pokemon/:id/...
    if (pathParts.length >= 1 && pathParts[0] !== 'team' && pathParts[0] !== 'evolution-ready' && pathParts[0] !== '') {
      const pokemonId = pathParts[0];

      // GET /api/pokemon/:id
      if (pathParts.length === 1 && req.method === 'GET') {
        const pokemon = await pokemonService.getPokemonById(auth.userId, pokemonId);
        if (!pokemon) {
          return res.status(404).json({ error: 'Pokemon not found' });
        }
        return res.status(200).json(pokemon);
      }

      // PATCH /api/pokemon/:id
      if (pathParts.length === 1 && req.method === 'PATCH') {
        const { nickname, isFavorite } = req.body || {};
        const pokemon = await pokemonService.updatePokemon(auth.userId, pokemonId, { nickname, isFavorite });
        return res.status(200).json(pokemon);
      }

      // GET /api/pokemon/:id/sell (preview)
      if (pathParts[1] === 'sell' && req.method === 'GET') {
        const preview = await sellService.getSellPricePreview(auth.userId, pokemonId);
        return res.status(200).json(preview);
      }

      // POST /api/pokemon/:id/sell
      if (pathParts[1] === 'sell' && req.method === 'POST') {
        const result = await sellService.sellPokemon(auth.userId, pokemonId);
        return res.status(200).json({
          success: true,
          coinsReceived: result.coinsReceived,
          newBalance: result.newBalance,
          soldPokemon: { speciesId: result.speciesId, speciesName: result.speciesName }
        });
      }

      // POST /api/pokemon/:id/evolve
      if (pathParts[1] === 'evolve' && req.method === 'POST') {
        const result = await evolutionService.evolvePokemon(auth.userId, pokemonId);
        return res.status(200).json(result);
      }

      // PATCH /api/pokemon/:id/evolution-settings
      if (pathParts[1] === 'evolution-settings' && req.method === 'PATCH') {
        const { suppressNotification } = req.body || {};
        if (typeof suppressNotification !== 'boolean') {
          return res.status(400).json({ error: 'suppressNotification must be a boolean' });
        }
        await evolutionService.updateEvolutionSettings(auth.userId, pokemonId, suppressNotification);
        return res.status(200).json({ success: true });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Pokemon error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      if (error.message === 'Pokemon not found') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
