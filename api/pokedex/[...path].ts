import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, AuthError } from '../../apps/api/src/utils/auth.js';
import { pokedexService } from '../../apps/api/src/services/pokedex.service.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ''];
  const path = pathParts.join('/');

  try {
    const auth = await requireAuth(req);

    // GET /api/pokedex
    if ((path === '' || pathParts.length === 1 && pathParts[0] === '') && req.method === 'GET') {
      const result = await pokedexService.getUserPokedex(auth.userId, {
        generation: parseIntParam(req.query.generation),
        types: parseQueryParam(req.query.types)?.split(','),
        obtained: parseBoolParam(req.query.obtained),
        search: parseQueryParam(req.query.search),
        page: parseIntParam(req.query.page),
        pageSize: parseIntParam(req.query.pageSize)
      });
      return res.status(200).json(result);
    }

    // GET /api/pokedex/stats
    if (path === 'stats' && req.method === 'GET') {
      const stats = await pokedexService.getPokedexStats(auth.userId);
      return res.status(200).json(stats);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Pokedex error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
