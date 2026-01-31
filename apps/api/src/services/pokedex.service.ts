import { prisma } from '../lib/prisma.js';
import { TOTAL_POKEMON_SPECIES, GENERATIONS } from '@pokemon-marketplace/shared';

interface PokedexFilters {
  generation?: number;
  types?: string[];
  obtained?: boolean;
  owned?: boolean;    // Filter by currently owned
  seen?: boolean;     // Filter by seen (ever obtained)
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

    // Combine data with seen/owned status
    let entries = species.map(s => {
      const pokedexEntry = obtainedMap.get(s.id);
      const seen = pokedexEntry !== undefined; // User has obtained at least once
      const owned = pokedexEntry?.hasCurrently ?? false; // User currently has one

      return {
        species: s,
        obtained: seen,
        firstObtainedAt: pokedexEntry?.firstObtainedAt || null,
        timesObtained: pokedexEntry?.timesObtained || 0,
        // Seen vs Owned tracking
        seen,
        owned,
        hasCurrently: owned
      };
    });

    // Filter by obtained status if requested
    if (obtained !== undefined) {
      entries = entries.filter(e => e.obtained === obtained);
    }

    // Filter by owned status if requested
    if (filters.owned !== undefined) {
      entries = entries.filter(e => e.owned === filters.owned);
    }

    // Filter by seen status if requested
    if (filters.seen !== undefined) {
      entries = entries.filter(e => e.seen === filters.seen);
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
    // Total seen (ever obtained)
    const seen = await prisma.userPokedex.count({
      where: { userId }
    });

    // Total owned (currently has)
    const owned = await prisma.userPokedex.count({
      where: { userId, hasCurrently: true }
    });

    // Legacy: obtained = seen
    const obtained = seen;

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
      seen,
      owned,
      percentage: Math.round((obtained / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
      seenPercentage: Math.round((seen / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
      ownedPercentage: Math.round((owned / TOTAL_POKEMON_SPECIES) * 100 * 10) / 10,
      byGeneration,
      byType,
      byRarity
    };
  }

  /**
   * Update hasCurrently status for a species based on user's current ownership
   */
  async updateHasCurrently(userId: string, speciesId: number): Promise<void> {
    // Count how many of this species the user currently has
    const count = await prisma.userPokemon.count({
      where: {
        userId,
        speciesId
      }
    });

    // Update the pokedex entry
    await prisma.userPokedex.updateMany({
      where: {
        userId,
        speciesId
      },
      data: {
        hasCurrently: count > 0
      }
    });
  }

  /**
   * Batch update hasCurrently for multiple species
   */
  async updateHasCurrentlyBatch(userId: string, speciesIds: number[]): Promise<void> {
    for (const speciesId of speciesIds) {
      await this.updateHasCurrently(userId, speciesId);
    }
  }

  /**
   * Recalculate hasCurrently for all of a user's pokedex entries
   */
  async recalculateAllHasCurrently(userId: string): Promise<number> {
    // Get all species the user has in their pokedex
    const pokedexEntries = await prisma.userPokedex.findMany({
      where: { userId },
      select: { speciesId: true }
    });

    // Get all species the user currently owns
    const ownedSpecies = await prisma.userPokemon.groupBy({
      by: ['speciesId'],
      where: { userId }
    });

    const ownedSpeciesIds = new Set(ownedSpecies.map(p => p.speciesId));

    let updated = 0;

    // Update each pokedex entry
    for (const entry of pokedexEntries) {
      const hasCurrently = ownedSpeciesIds.has(entry.speciesId);

      await prisma.userPokedex.update({
        where: {
          userId_speciesId: {
            userId,
            speciesId: entry.speciesId
          }
        },
        data: { hasCurrently }
      });

      updated++;
    }

    return updated;
  }
}

export const pokedexService = new PokedexService();
