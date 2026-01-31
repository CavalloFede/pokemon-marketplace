import { prisma } from '../lib/prisma.js';
import {
  MAX_LEVEL,
  getExpForLevel,
  getExpToNextLevel,
  getLevelFromExp,
  calculatePassiveExp
} from '@pokemon-marketplace/shared';

interface LevelInfo {
  level: number;
  experience: number;
  expToNextLevel: number;
  expForCurrentLevel: number;
  expProgress: number; // 0-100 percentage
  isMaxLevel: boolean;
}

interface LevelUpResult {
  previousLevel: number;
  newLevel: number;
  levelsGained: number;
  newExperience: number;
}

export class LevelService {
  /**
   * Calculate current level info for a Pokemon based on stored exp and time passed
   */
  calculateLevelInfo(
    storedLevel: number,
    storedExperience: number,
    lastExperienceGainAt: Date
  ): LevelInfo {
    // Calculate passive exp gained since last update
    const now = new Date();
    const hoursElapsed = (now.getTime() - lastExperienceGainAt.getTime()) / (1000 * 60 * 60);
    const passiveExp = calculatePassiveExp(hoursElapsed, storedLevel);

    // Total experience
    const totalExperience = storedExperience + passiveExp;

    // Calculate actual level from total exp
    const actualLevel = getLevelFromExp(totalExperience);
    const level = Math.min(actualLevel, MAX_LEVEL);

    // Calculate progress to next level
    const expForCurrentLevel = getExpForLevel(level);
    const expToNextLevel = getExpToNextLevel(level, totalExperience);
    const expForNextLevel = getExpForLevel(level + 1);
    const expInCurrentLevel = totalExperience - expForCurrentLevel;
    const expNeededForLevel = expForNextLevel - expForCurrentLevel;

    const expProgress = level >= MAX_LEVEL
      ? 100
      : Math.min(100, Math.floor((expInCurrentLevel / expNeededForLevel) * 100));

    return {
      level,
      experience: totalExperience,
      expToNextLevel,
      expForCurrentLevel,
      expProgress,
      isMaxLevel: level >= MAX_LEVEL
    };
  }

  /**
   * Update Pokemon's level based on time passed (call periodically or on access)
   */
  async updatePokemonLevel(pokemonId: string): Promise<LevelUpResult | null> {
    const pokemon = await prisma.userPokemon.findUnique({
      where: { id: pokemonId },
      include: { species: true }
    });

    if (!pokemon) {
      return null;
    }

    const levelInfo = this.calculateLevelInfo(
      pokemon.level,
      pokemon.experience,
      pokemon.lastExperienceGainAt
    );

    // Only update if level or exp changed significantly
    if (levelInfo.level === pokemon.level &&
        Math.abs(levelInfo.experience - pokemon.experience) < 10) {
      return null;
    }

    const levelsGained = levelInfo.level - pokemon.level;

    // Update in database
    await prisma.userPokemon.update({
      where: { id: pokemonId },
      data: {
        level: levelInfo.level,
        experience: levelInfo.experience,
        lastExperienceGainAt: new Date()
      }
    });

    if (levelsGained > 0) {
      return {
        previousLevel: pokemon.level,
        newLevel: levelInfo.level,
        levelsGained,
        newExperience: levelInfo.experience
      };
    }

    return null;
  }

  /**
   * Get initial level for a Pokemon based on its evolution stage
   */
  async getInitialLevel(speciesId: number): Promise<number> {
    const species = await prisma.pokemonSpecies.findUnique({
      where: { id: speciesId },
      select: {
        evolutionLevel: true,
        evolvesFromId: true
      }
    });

    if (!species) {
      return 1;
    }

    // If it's an evolved form, start at the evolution level
    if (species.evolvesFromId && species.evolutionLevel) {
      return species.evolutionLevel;
    }

    // Base form starts at level 1
    return 1;
  }

  /**
   * Batch update levels for all Pokemon of a user
   */
  async updateAllUserPokemonLevels(userId: string): Promise<number> {
    const pokemon = await prisma.userPokemon.findMany({
      where: { userId },
      select: {
        id: true,
        level: true,
        experience: true,
        lastExperienceGainAt: true
      }
    });

    let updatedCount = 0;

    for (const p of pokemon) {
      const result = await this.updatePokemonLevel(p.id);
      if (result && result.levelsGained > 0) {
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Check if Pokemon can evolve based on level
   */
  async canEvolve(pokemonId: string): Promise<{
    canEvolve: boolean;
    targetSpeciesId?: number;
    targetSpeciesName?: string;
    requiredLevel?: number;
    currentLevel?: number;
  }> {
    const pokemon = await prisma.userPokemon.findUnique({
      where: { id: pokemonId },
      include: {
        species: {
          include: {
            evolvesTo: true
          }
        }
      }
    });

    if (!pokemon) {
      return { canEvolve: false };
    }

    // Calculate current level with passive exp
    const levelInfo = this.calculateLevelInfo(
      pokemon.level,
      pokemon.experience,
      pokemon.lastExperienceGainAt
    );

    // Check if there's an evolution target
    const evolutionTarget = pokemon.species.evolvesTo[0]; // Get first evolution
    if (!evolutionTarget) {
      return { canEvolve: false }; // No evolution available
    }

    const requiredLevel = evolutionTarget.evolutionLevel || 0;
    const canEvolve = levelInfo.level >= requiredLevel;

    return {
      canEvolve,
      targetSpeciesId: evolutionTarget.id,
      targetSpeciesName: evolutionTarget.name,
      requiredLevel,
      currentLevel: levelInfo.level
    };
  }
}

export const levelService = new LevelService();
