import { prisma } from '../lib/prisma.js';
import { levelService } from './level.service.js';
import { metricsService } from './metrics.service.js';

interface EvolutionResult {
  success: boolean;
  pokemon: {
    id: string;
    previousSpeciesId: number;
    previousSpeciesName: string;
    newSpeciesId: number;
    newSpeciesName: string;
    isShiny: boolean;
    level: number;
  };
  isNewPokedexEntry: boolean;
}

interface EvolutionReadyPokemon {
  id: string;
  nickname: string | null;
  isShiny: boolean;
  level: number;
  currentSpecies: {
    id: number;
    name: string;
    spriteUrl: string;
    spriteShinyUrl: string;
  };
  targetSpecies: {
    id: number;
    name: string;
    spriteUrl: string;
    spriteShinyUrl: string;
    evolutionLevel: number;
  };
}

export class EvolutionService {
  /**
   * Get all Pokemon that are ready to evolve for a user
   */
  async getEvolutionReadyPokemon(userId: string): Promise<EvolutionReadyPokemon[]> {
    // Get all user's Pokemon that have evolutions available
    const pokemon = await prisma.userPokemon.findMany({
      where: {
        userId,
        suppressEvolutionNotification: false
      },
      include: {
        species: {
          include: {
            evolvesTo: true
          }
        }
      }
    });

    const readyPokemon: EvolutionReadyPokemon[] = [];

    for (const p of pokemon) {
      // Check if has evolution target
      if (p.species.evolvesTo.length === 0) continue;

      const evolutionTarget = p.species.evolvesTo[0];
      if (!evolutionTarget.evolutionLevel) continue;

      // Calculate current level with passive exp
      const levelInfo = levelService.calculateLevelInfo(
        p.level,
        p.experience,
        p.lastExperienceGainAt
      );

      // Check if level is sufficient
      if (levelInfo.level >= evolutionTarget.evolutionLevel) {
        readyPokemon.push({
          id: p.id,
          nickname: p.nickname,
          isShiny: p.isShiny,
          level: levelInfo.level,
          currentSpecies: {
            id: p.species.id,
            name: p.species.name,
            spriteUrl: p.species.spriteUrl,
            spriteShinyUrl: p.species.spriteShinyUrl
          },
          targetSpecies: {
            id: evolutionTarget.id,
            name: evolutionTarget.name,
            spriteUrl: evolutionTarget.spriteUrl,
            spriteShinyUrl: evolutionTarget.spriteShinyUrl,
            evolutionLevel: evolutionTarget.evolutionLevel
          }
        });
      }
    }

    return readyPokemon;
  }

  /**
   * Evolve a Pokemon
   */
  async evolvePokemon(userId: string, pokemonId: string): Promise<EvolutionResult> {
    // Get Pokemon with species info
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
      throw new Error('Pokemon not found');
    }

    // Check if has evolution
    if (pokemon.species.evolvesTo.length === 0) {
      throw new Error('This Pokemon cannot evolve');
    }

    const evolutionTarget = pokemon.species.evolvesTo[0];

    // Calculate current level
    const levelInfo = levelService.calculateLevelInfo(
      pokemon.level,
      pokemon.experience,
      pokemon.lastExperienceGainAt
    );

    // Check if level is sufficient
    if (evolutionTarget.evolutionLevel && levelInfo.level < evolutionTarget.evolutionLevel) {
      throw new Error(
        `Level ${evolutionTarget.evolutionLevel} required to evolve. Current level: ${levelInfo.level}`
      );
    }

    // Execute evolution in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update Pokemon to new species (keep isShiny!)
      const updatedPokemon = await tx.userPokemon.update({
        where: { id: pokemonId },
        data: {
          speciesId: evolutionTarget.id,
          level: levelInfo.level,
          experience: levelInfo.experience,
          lastExperienceGainAt: new Date()
          // isShiny stays the same - shiny evolves to shiny!
        },
        include: {
          species: true
        }
      });

      // Check if this is a new Pokedex entry
      const existingPokedexEntry = await tx.userPokedex.findUnique({
        where: {
          userId_speciesId: {
            userId,
            speciesId: evolutionTarget.id
          }
        }
      });

      const isNewPokedexEntry = !existingPokedexEntry;

      // Update or create Pokedex entry for evolved form
      if (existingPokedexEntry) {
        await tx.userPokedex.update({
          where: {
            userId_speciesId: {
              userId,
              speciesId: evolutionTarget.id
            }
          },
          data: {
            timesObtained: { increment: 1 },
            hasCurrently: true
          }
        });
      } else {
        await tx.userPokedex.create({
          data: {
            userId,
            speciesId: evolutionTarget.id,
            hasCurrently: true
          }
        });
      }

      // Update hasCurrently for previous species (check if still have any)
      const remainingOfPreviousSpecies = await tx.userPokemon.count({
        where: {
          userId,
          speciesId: pokemon.speciesId
        }
      });

      if (remainingOfPreviousSpecies === 0) {
        await tx.userPokedex.update({
          where: {
            userId_speciesId: {
              userId,
              speciesId: pokemon.speciesId
            }
          },
          data: {
            hasCurrently: false
          }
        });
      }

      return {
        updatedPokemon,
        isNewPokedexEntry
      };
    });

    // Track metrics
    await metricsService.trackPokemonObtained(
      evolutionTarget.rarity,
      'evolution'
    );

    return {
      success: true,
      pokemon: {
        id: result.updatedPokemon.id,
        previousSpeciesId: pokemon.speciesId,
        previousSpeciesName: pokemon.species.name,
        newSpeciesId: result.updatedPokemon.speciesId,
        newSpeciesName: result.updatedPokemon.species.name,
        isShiny: result.updatedPokemon.isShiny,
        level: levelInfo.level
      },
      isNewPokedexEntry: result.isNewPokedexEntry
    };
  }

  /**
   * Update evolution notification settings for a Pokemon
   */
  async updateEvolutionSettings(
    userId: string,
    pokemonId: string,
    suppressNotification: boolean
  ): Promise<void> {
    const pokemon = await prisma.userPokemon.findFirst({
      where: {
        id: pokemonId,
        userId
      }
    });

    if (!pokemon) {
      throw new Error('Pokemon not found');
    }

    await prisma.userPokemon.update({
      where: { id: pokemonId },
      data: {
        suppressEvolutionNotification: suppressNotification
      }
    });
  }
}

export const evolutionService = new EvolutionService();
