import { prisma } from '../lib/prisma.js';
import { levelService } from '../services/level.service.js';

const BATCH_SIZE = 100;

interface LevelUpdateResult {
  totalProcessed: number;
  pokemonLeveledUp: number;
  errors: number;
  duration: number;
}

/**
 * Job to update Pokemon levels based on passive experience gain.
 * Should be run periodically (e.g., every hour via cron).
 */
export async function runLevelUpdater(): Promise<LevelUpdateResult> {
  const startTime = Date.now();
  let totalProcessed = 0;
  let pokemonLeveledUp = 0;
  let errors = 0;

  console.log('[LevelUpdater] Starting level update job...');

  try {
    // Get total count of Pokemon
    const totalPokemon = await prisma.userPokemon.count();
    console.log(`[LevelUpdater] Total Pokemon to process: ${totalPokemon}`);

    // Process in batches
    let skip = 0;
    while (skip < totalPokemon) {
      const batch = await prisma.userPokemon.findMany({
        skip,
        take: BATCH_SIZE,
        select: {
          id: true,
          level: true,
          experience: true,
          lastExperienceGainAt: true
        }
      });

      if (batch.length === 0) break;

      for (const pokemon of batch) {
        try {
          const result = await levelService.updatePokemonLevel(pokemon.id);
          totalProcessed++;

          if (result && result.levelsGained > 0) {
            pokemonLeveledUp++;
            console.log(
              `[LevelUpdater] Pokemon ${pokemon.id} leveled up: ${result.previousLevel} -> ${result.newLevel}`
            );
          }
        } catch (error) {
          errors++;
          console.error(`[LevelUpdater] Error updating Pokemon ${pokemon.id}:`, error);
        }
      }

      skip += BATCH_SIZE;

      // Progress log every 500 Pokemon
      if (totalProcessed % 500 === 0) {
        console.log(`[LevelUpdater] Progress: ${totalProcessed}/${totalPokemon}`);
      }
    }
  } catch (error) {
    console.error('[LevelUpdater] Fatal error:', error);
    throw error;
  }

  const duration = Date.now() - startTime;

  const result: LevelUpdateResult = {
    totalProcessed,
    pokemonLeveledUp,
    errors,
    duration
  };

  console.log('[LevelUpdater] Job completed:', result);

  return result;
}

/**
 * Update levels for a specific user's Pokemon
 */
export async function updateUserPokemonLevels(userId: string): Promise<{
  updated: number;
  leveledUp: number;
}> {
  const updated = await levelService.updateAllUserPokemonLevels(userId);

  return {
    updated,
    leveledUp: updated
  };
}

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  runLevelUpdater()
    .then((result) => {
      console.log('Level updater completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Level updater failed:', error);
      process.exit(1);
    });
}
