import { prisma } from '../lib/prisma.js';
import { MAX_TEAM_SIZE } from '@pokemon-marketplace/shared';
import { levelService } from './level.service.js';

interface CollectionFilters {
  rarity?: string[];
  types?: string[];
  isInTeam?: boolean;
  isFavorite?: boolean;
  isShiny?: boolean;
  search?: string;
  sortBy?: 'name' | 'obtainedAt' | 'rarity' | 'speciesId';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export class PokemonService {
  /**
   * Get user's pokemon collection with filters
   */
  async getUserCollection(userId: string, filters: CollectionFilters = {}) {
    const {
      rarity,
      types,
      isInTeam,
      isFavorite,
      isShiny,
      search,
      sortBy = 'obtainedAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20
    } = filters;

    // Build where clause
    const where: any = { userId };

    if (isInTeam !== undefined) {
      where.isInTeam = isInTeam;
    }

    if (isFavorite !== undefined) {
      where.isFavorite = isFavorite;
    }

    if (isShiny !== undefined) {
      where.isShiny = isShiny;
    }

    if (rarity && rarity.length > 0) {
      where.species = { ...where.species, rarity: { in: rarity } };
    }

    if (types && types.length > 0) {
      where.species = { ...where.species, types: { hasSome: types } };
    }

    if (search) {
      where.OR = [
        { nickname: { contains: search, mode: 'insensitive' } },
        { species: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Build orderBy
    let orderBy: any;
    switch (sortBy) {
      case 'name':
        orderBy = { species: { name: sortOrder } };
        break;
      case 'rarity':
        orderBy = { species: { rarity: sortOrder } };
        break;
      case 'speciesId':
        orderBy = { speciesId: sortOrder };
        break;
      default:
        orderBy = { obtainedAt: sortOrder };
    }

    const [pokemon, total] = await Promise.all([
      prisma.userPokemon.findMany({
        where,
        include: {
          species: {
            include: {
              evolvesTo: true
            }
          }
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.userPokemon.count({ where })
    ]);

    return {
      data: this.enhanceManyPokemonWithLevelInfo(pokemon),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Get user's team (up to 6 pokemon)
   */
  async getUserTeam(userId: string) {
    const team = await prisma.userPokemon.findMany({
      where: {
        userId,
        isInTeam: true
      },
      include: {
        species: {
          include: {
            evolvesTo: true
          }
        }
      },
      orderBy: { teamPosition: 'asc' }
    });

    return this.enhanceManyPokemonWithLevelInfo(team);
  }

  /**
   * Update user's team
   */
  async updateTeam(userId: string, pokemonIds: string[]) {
    if (pokemonIds.length > MAX_TEAM_SIZE) {
      throw new Error(`Team cannot exceed ${MAX_TEAM_SIZE} Pokemon`);
    }

    // Verify all pokemon belong to user
    const userPokemon = await prisma.userPokemon.findMany({
      where: {
        id: { in: pokemonIds },
        userId
      }
    });

    if (userPokemon.length !== pokemonIds.length) {
      throw new Error('Some Pokemon do not belong to you');
    }

    // Check for duplicates
    const uniqueIds = new Set(pokemonIds);
    if (uniqueIds.size !== pokemonIds.length) {
      throw new Error('Duplicate Pokemon in team');
    }

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      // Clear current team
      await tx.userPokemon.updateMany({
        where: { userId, isInTeam: true },
        data: { isInTeam: false, teamPosition: null }
      });

      // Set new team with positions
      for (let i = 0; i < pokemonIds.length; i++) {
        await tx.userPokemon.update({
          where: { id: pokemonIds[i] },
          data: {
            isInTeam: true,
            teamPosition: i + 1
          }
        });
      }
    });

    return this.getUserTeam(userId);
  }

  /**
   * Get single pokemon by ID
   */
  async getPokemonById(userId: string, pokemonId: string) {
    const pokemon = await prisma.userPokemon.findFirst({
      where: {
        id: pokemonId,
        userId
      },
      include: {
        species: {
          include: {
            evolvesTo: true
          }
        }
      }
    });

    if (!pokemon) {
      return null;
    }

    return this.enhancePokemonWithLevelInfo(pokemon);
  }

  /**
   * Update pokemon (nickname, favorite)
   */
  async updatePokemon(
    userId: string,
    pokemonId: string,
    data: {
      nickname?: string | null;
      isFavorite?: boolean;
    }
  ) {
    // Verify ownership
    const pokemon = await prisma.userPokemon.findFirst({
      where: { id: pokemonId, userId }
    });

    if (!pokemon) {
      throw new Error('Pokemon not found');
    }

    // Validate nickname
    if (data.nickname !== undefined && data.nickname !== null) {
      if (data.nickname.length < 1 || data.nickname.length > 20) {
        throw new Error('Nickname must be between 1 and 20 characters');
      }
    }

    const updated = await prisma.userPokemon.update({
      where: { id: pokemonId },
      data,
      include: { species: true }
    });

    return this.enhancePokemonWithLevelInfo(updated);
  }

  /**
   * Enhance pokemon data with calculated level info
   */
  private enhancePokemonWithLevelInfo<T extends {
    level: number;
    experience: number;
    lastExperienceGainAt: Date;
  }>(pokemon: T) {
    const levelInfo = levelService.calculateLevelInfo(
      pokemon.level,
      pokemon.experience,
      pokemon.lastExperienceGainAt
    );

    return {
      ...pokemon,
      levelInfo: {
        level: levelInfo.level,
        experience: levelInfo.experience,
        expToNextLevel: levelInfo.expToNextLevel,
        expProgress: levelInfo.expProgress,
        isMaxLevel: levelInfo.isMaxLevel
      }
    };
  }

  /**
   * Enhance multiple pokemon with level info
   */
  private enhanceManyPokemonWithLevelInfo<T extends {
    level: number;
    experience: number;
    lastExperienceGainAt: Date;
  }>(pokemonList: T[]) {
    return pokemonList.map(p => this.enhancePokemonWithLevelInfo(p));
  }
}

export const pokemonService = new PokemonService();
