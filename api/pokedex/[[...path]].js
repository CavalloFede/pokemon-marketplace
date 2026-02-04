import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

const TOTAL_POKEMON_SPECIES = 1025;
const GENERATIONS = {
  1: { start: 1, end: 151, name: 'Kanto' },
  2: { start: 152, end: 251, name: 'Johto' },
  3: { start: 252, end: 386, name: 'Hoenn' },
  4: { start: 387, end: 493, name: 'Sinnoh' },
  5: { start: 494, end: 649, name: 'Unova' },
  6: { start: 650, end: 721, name: 'Kalos' },
  7: { start: 722, end: 809, name: 'Alola' },
  8: { start: 810, end: 905, name: 'Galar' },
  9: { start: 906, end: 1025, name: 'Paldea' }
};

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

async function handlePokedexList(req, res, auth) {
  const generation = parseIntParam(req.query.generation);
  const types = parseQueryParam(req.query.types)?.split(',');
  const obtained = parseBoolParam(req.query.obtained);
  const owned = parseBoolParam(req.query.owned);
  const seen = parseBoolParam(req.query.seen);
  const search = parseQueryParam(req.query.search);
  const page = parseIntParam(req.query.page) || 1;
  const pageSize = parseIntParam(req.query.pageSize) || 50;

  const speciesWhere = {};
  if (generation !== undefined) speciesWhere.generation = generation;
  if (types && types.length > 0) speciesWhere.types = { hasSome: types };
  if (search) speciesWhere.name = { contains: search, mode: 'insensitive' };

  const species = await prisma.pokemonSpecies.findMany({
    where: speciesWhere,
    orderBy: { id: 'asc' },
    skip: (page - 1) * pageSize,
    take: pageSize
  });

  const totalSpecies = await prisma.pokemonSpecies.count({ where: speciesWhere });

  const userPokedex = await prisma.userPokedex.findMany({
    where: {
      userId: auth.userId,
      speciesId: { in: species.map(s => s.id) }
    }
  });

  const obtainedMap = new Map(userPokedex.map(p => [p.speciesId, p]));

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

  if (obtained !== undefined) entries = entries.filter(e => e.obtained === obtained);
  if (owned !== undefined) entries = entries.filter(e => e.owned === owned);
  if (seen !== undefined) entries = entries.filter(e => e.seen === seen);

  return res.status(200).json({
    data: entries,
    total: totalSpecies,
    page,
    pageSize,
    totalPages: Math.ceil(totalSpecies / pageSize)
  });
}

async function handlePokedexStats(req, res, auth) {
  const seenCount = await prisma.userPokedex.count({ where: { userId: auth.userId } });
  const ownedCount = await prisma.userPokedex.count({ where: { userId: auth.userId, hasCurrently: true } });
  const obtained = seenCount;

  const byGeneration = {};
  for (const [gen, data] of Object.entries(GENERATIONS)) {
    const genNum = parseInt(gen);
    const total = data.end - data.start + 1;
    const obtainedInGen = await prisma.userPokedex.count({
      where: { userId: auth.userId, speciesId: { gte: data.start, lte: data.end } }
    });
    byGeneration[genNum] = { total, obtained: obtainedInGen };
  }

  const typeStats = await prisma.$queryRaw`
    SELECT unnest(ps.types) as type, COUNT(DISTINCT up.species_id) as count
    FROM user_pokedex up
    JOIN pokemon_species ps ON up.species_id = ps.id
    WHERE up.user_id = ${auth.userId}
    GROUP BY type
    ORDER BY count DESC
  `;

  const byType = {};
  for (const row of typeStats) {
    byType[row.type] = { obtained: Number(row.count) };
  }

  const rarityStats = await prisma.userPokedex.groupBy({
    by: ['speciesId'],
    where: { userId: auth.userId },
    _count: true
  });

  const obtainedSpeciesIds = rarityStats.map(r => r.speciesId);

  const byRarityRaw = await prisma.pokemonSpecies.groupBy({
    by: ['rarity'],
    where: { id: { in: obtainedSpeciesIds } },
    _count: { id: true }
  });

  const totalByRarity = await prisma.pokemonSpecies.groupBy({
    by: ['rarity'],
    _count: { id: true }
  });

  const byRarity = {};
  for (const row of totalByRarity) {
    const obtainedRow = byRarityRaw.find(r => r.rarity === row.rarity);
    byRarity[row.rarity] = {
      total: row._count.id,
      obtained: obtainedRow?._count.id || 0
    };
  }

  return res.status(200).json({
    totalSpecies: TOTAL_POKEMON_SPECIES,
    obtained,
    seen: seenCount,
    owned: ownedCount,
    percentage: Math.round((obtained / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
    seenPercentage: Math.round((seenCount / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
    ownedPercentage: Math.round((ownedCount / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
    byGeneration,
    byType,
    byRarity
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pathParts = req.query.path || [];
  const route = pathParts.join('/');

  try {
    const auth = await requireAuth(req);

    if (route === '' || route === undefined) {
      return handlePokedexList(req, res, auth);
    }

    if (route === 'stats') {
      return handlePokedexStats(req, res, auth);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Pokedex error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
