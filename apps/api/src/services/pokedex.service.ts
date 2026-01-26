import { prisma } from '../lib/prisma.js';
import { TOTAL_POKEMON_SPECIES, GENERATIONS } from '@pokemon-marketplace/shared';

interface PokedexFilters {
  generation?: number;
  types?: string[];
  obtained?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export class PokedexService {
  /**
   * Get user's pokedex with all species
   */
  async getUserPokedex(userId: string, filters: PokedexFilters = {}) {
    const {
      generation,
      types,
      obtained,
      search,
      page = 1,
      pageSize = 50
    } = filters;

    // Build where clause for species
    const speciesWhere: any = {};

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
        userId,
        speciesId: { in: species.map(s => s.id) }
      }
    });

    const obtainedMap = new Map(
      userPokedex.map(p => [p.speciesId, p])
    );

    // Combine data
    let entries = species.map(s => ({
      species: s,
      obtained: obtainedMap.has(s.id),
      firstObtainedAt: obtainedMap.get(s.id)?.firstObtainedAt || null,
      timesObtained: obtainedMap.get(s.id)?.timesObtained || 0
    }));

    // Filter by obtained status if requested
    if (obtained !== undefined) {
      entries = entries.filter(e => e.obtained === obtained);
    }

    return {
      data: entries,
      total: totalSpecies,
      page,
      pageSize,
      totalPages: Math.ceil(totalSpecies / pageSize)
    };
  }

  /**
   * Get pokedex completion stats
   */
  async getPokedexStats(userId: string) {
    // Total obtained
    const obtained = await prisma.userPokedex.count({
      where: { userId }
    });

    // By generation
    const byGeneration: Record<number, { total: number; obtained: number }> = {};

    for (const [gen, data] of Object.entries(GENERATIONS)) {
      const genNum = parseInt(gen);
      const total = data.end - data.start + 1;

      const obtainedInGen = await prisma.userPokedex.count({
        where: {
          userId,
          speciesId: {
            gte: data.start,
            lte: data.end
          }
        }
      });

      byGeneration[genNum] = { total, obtained: obtainedInGen };
    }

    // By type (top types)
    const typeStats = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
      SELECT unnest(ps.types) as type, COUNT(DISTINCT up.species_id) as count
      FROM user_pokedex up
      JOIN pokemon_species ps ON up.species_id = ps.id
      WHERE up.user_id = ${userId}
      GROUP BY type
      ORDER BY count DESC
    `;

    const byType: Record<string, { obtained: number }> = {};
    for (const row of typeStats) {
      byType[row.type] = { obtained: Number(row.count) };
    }

    // By rarity
    const rarityStats = await prisma.userPokedex.groupBy({
      by: ['speciesId'],
      where: { userId },
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

    const byRarity: Record<string, { total: number; obtained: number }> = {};
    for (const row of totalByRarity) {
      const obtainedRow = byRarityRaw.find(r => r.rarity === row.rarity);
      byRarity[row.rarity] = {
        total: row._count.id,
        obtained: obtainedRow?._count.id || 0
      };
    }

    return {
      totalSpecies: TOTAL_POKEMON_SPECIES,
      obtained,
      percentage: Math.round((obtained / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
      byGeneration,
      byType,
      byRarity
    };
  }
}

export const pokedexService = new PokedexService();
