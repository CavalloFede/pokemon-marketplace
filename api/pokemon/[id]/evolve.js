import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Level calculation constants
const BASE_EXP_PER_LEVEL = 100;
const EXP_GROWTH_RATE = 1.15;
const MAX_LEVEL = 100;
const PASSIVE_EXP_PER_HOUR = 10;
const MAX_PASSIVE_HOURS = 24;

function getExpForLevel(level) {
  if (level <= 1) return 0;
  let totalExp = 0;
  for (let i = 2; i <= level; i++) {
    totalExp += Math.floor(BASE_EXP_PER_LEVEL * Math.pow(EXP_GROWTH_RATE, i - 2));
  }
  return totalExp;
}

function calculateLevelInfo(baseLevel, baseExp, lastExpGainAt) {
  const now = new Date();
  const hoursSince = lastExpGainAt
    ? (now.getTime() - new Date(lastExpGainAt).getTime()) / (1000 * 60 * 60)
    : 0;
  const passiveHours = Math.min(hoursSince, MAX_PASSIVE_HOURS);
  const passiveExp = Math.floor(passiveHours * PASSIVE_EXP_PER_HOUR);
  const totalExp = baseExp + passiveExp;

  let level = baseLevel;
  let expForNext = getExpForLevel(level + 1);
  while (totalExp >= expForNext && level < MAX_LEVEL) {
    level++;
    expForNext = getExpForLevel(level + 1);
  }

  return { level, totalExp };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id: pokemonId } = req.query;

  try {
    const auth = await requireAuth(req);

    const pokemon = await prisma.userPokemon.findFirst({
      where: { id: pokemonId, userId: auth.userId },
      include: { species: { include: { evolvesTo: true } } }
    });

    if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });

    if (pokemon.species.evolvesTo.length === 0) {
      return res.status(400).json({ error: 'This Pokemon cannot evolve' });
    }

    const evolutionTarget = pokemon.species.evolvesTo[0];
    const levelInfo = calculateLevelInfo(pokemon.level, pokemon.experience, pokemon.lastExperienceGainAt);

    if (evolutionTarget.evolutionLevel && levelInfo.level < evolutionTarget.evolutionLevel) {
      return res.status(400).json({
        error: `Level ${evolutionTarget.evolutionLevel} required to evolve. Current level: ${levelInfo.level}`
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPokemon = await tx.userPokemon.update({
        where: { id: pokemonId },
        data: {
          speciesId: evolutionTarget.id,
          level: levelInfo.level,
          experience: levelInfo.totalExp,
          lastExperienceGainAt: new Date()
        },
        include: { species: true }
      });

      // Update/create pokedex entries
      const existingEntry = await tx.userPokedex.findUnique({
        where: { userId_speciesId: { userId: auth.userId, speciesId: evolutionTarget.id } }
      });

      const isNewPokedexEntry = !existingEntry;

      if (existingEntry) {
        await tx.userPokedex.update({
          where: { userId_speciesId: { userId: auth.userId, speciesId: evolutionTarget.id } },
          data: { timesObtained: { increment: 1 }, hasCurrently: true }
        });
      } else {
        await tx.userPokedex.create({
          data: { userId: auth.userId, speciesId: evolutionTarget.id, hasCurrently: true }
        });
      }

      // Check if user still has previous species
      const remainingPrevious = await tx.userPokemon.count({
        where: { userId: auth.userId, speciesId: pokemon.speciesId }
      });

      if (remainingPrevious === 0) {
        await tx.userPokedex.updateMany({
          where: { userId: auth.userId, speciesId: pokemon.speciesId },
          data: { hasCurrently: false }
        });
      }

      return { updatedPokemon, isNewPokedexEntry };
    });

    return res.status(200).json({
      success: true,
      pokemon: {
        id: result.updatedPokemon.id,
        previousSpeciesId: pokemon.speciesId,
        previousSpeciesName: pokemon.species.name,
        newSpeciesId: evolutionTarget.id,
        newSpeciesName: evolutionTarget.name,
        isShiny: pokemon.isShiny,
        level: levelInfo.level
      },
      isNewPokedexEntry: result.isNewPokedexEntry
    });
  } catch (error) {
    console.error('Evolve pokemon error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
