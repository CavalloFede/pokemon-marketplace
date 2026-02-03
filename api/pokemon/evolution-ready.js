import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);

    const pokemon = await prisma.userPokemon.findMany({
      where: { userId: auth.userId, suppressEvolutionNotification: false },
      include: { species: { include: { evolvesTo: true } } }
    });

    const readyPokemon = [];

    for (const p of pokemon) {
      if (p.species.evolvesTo.length === 0) continue;
      const evolutionTarget = p.species.evolvesTo[0];
      if (!evolutionTarget.evolutionLevel) continue;

      const levelInfo = calculateLevelInfo(p.level, p.experience, p.lastExperienceGainAt);

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

    return res.status(200).json({ pokemon: readyPokemon });
  } catch (error) {
    console.error('Evolution ready error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
