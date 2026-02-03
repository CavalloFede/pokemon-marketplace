import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

function parseQueryParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(value) {
  const str = parseQueryParam(value);
  if (!str) return undefined;
  const num = parseInt(str, 10);
  return isNaN(num) ? undefined : num;
}

function parseBoolParam(value) {
  const str = parseQueryParam(value);
  if (str === 'true') return true;
  if (str === 'false') return false;
  return undefined;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);

    const generation = parseIntParam(req.query.generation);
    const types = parseQueryParam(req.query.types)?.split(',');
    const obtained = parseBoolParam(req.query.obtained);
    const owned = parseBoolParam(req.query.owned);
    const seen = parseBoolParam(req.query.seen);
    const search = parseQueryParam(req.query.search);
    const page = parseIntParam(req.query.page) || 1;
    const pageSize = parseIntParam(req.query.pageSize) || 50;

    // Build where clause for species
    const speciesWhere = {};

    if (generation !== undefined) {
      speciesWhere.generation = generation;
    }

    if (types && types.length > 0) {
      speciesWhere.types = { hasSome: types };
    }

    if (search) {
      speciesWhere.name = { contains: search, mode: 'insensitive' };
    }

    // Get all species matching filters
    const species = await prisma.pokemonSpecies.findMany({
      where: speciesWhere,
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    const totalSpecies = await prisma.pokemonSpecies.count({ where: speciesWhere });

    // Get user's obtained species
    const userPokedex = await prisma.userPokedex.findMany({
      where: {
        userId: auth.userId,
        speciesId: { in: species.map(s => s.id) }
      }
    });

    const obtainedMap = new Map(
      userPokedex.map(p => [p.speciesId, p])
    );

    // Combine data with seen/owned status
    let entries = species.map(s => {
      const pokedexEntry = obtainedMap.get(s.id);
      const seenStatus = pokedexEntry !== undefined;
      const ownedStatus = pokedexEntry?.hasCurrently ?? false;

      return {
        species: s,
        obtained: seenStatus,
        firstObtainedAt: pokedexEntry?.firstObtainedAt || null,
        timesObtained: pokedexEntry?.timesObtained || 0,
        seen: seenStatus,
        owned: ownedStatus,
        hasCurrently: ownedStatus
      };
    });

    // Filter by obtained status if requested
    if (obtained !== undefined) {
      entries = entries.filter(e => e.obtained === obtained);
    }

    // Filter by owned status if requested
    if (owned !== undefined) {
      entries = entries.filter(e => e.owned === owned);
    }

    // Filter by seen status if requested
    if (seen !== undefined) {
      entries = entries.filter(e => e.seen === seen);
    }

    return res.status(200).json({
      data: entries,
      total: totalSpecies,
      page,
      pageSize,
      totalPages: Math.ceil(totalSpecies / pageSize)
    });
  } catch (error) {
    console.error('Pokedex error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
