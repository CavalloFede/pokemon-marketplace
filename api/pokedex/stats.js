import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Inlined constants from shared package
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);

    // Total seen (ever obtained)
    const seen = await prisma.userPokedex.count({
      where: { userId: auth.userId }
    });

    // Total owned (currently has)
    const owned = await prisma.userPokedex.count({
      where: { userId: auth.userId, hasCurrently: true }
    });

    // Legacy: obtained = seen
    const obtained = seen;

    // By generation
    const byGeneration = {};

    for (const [gen, data] of Object.entries(GENERATIONS)) {
      const genNum = parseInt(gen);
      const total = data.end - data.start + 1;

      const obtainedInGen = await prisma.userPokedex.count({
        where: {
          userId: auth.userId,
          speciesId: {
            gte: data.start,
            lte: data.end
          }
        }
      });

      byGeneration[genNum] = { total, obtained: obtainedInGen };
    }

    // By type (top types)
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

    // By rarity
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
      seen,
      owned,
      percentage: Math.round((obtained / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
      seenPercentage: Math.round((seen / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
      ownedPercentage: Math.round((owned / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
      byGeneration,
      byType,
      byRarity
    });
  } catch (error) {
    console.error('Pokedex stats error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
