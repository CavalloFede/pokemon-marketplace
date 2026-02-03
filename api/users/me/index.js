import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Daily reward constants
const DAILY_REWARDS = { 1: 100, 2: 150, 3: 175, 4: 200, 5: 200 };
const MAX_DAILY_REWARD = 200;

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function isYesterday(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
}

function calculateReward(streakDay) {
  if (streakDay >= 5) return MAX_DAILY_REWARD;
  return DAILY_REWARDS[streakDay] || DAILY_REWARDS[1];
}

async function canClaimDailyReward(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastDailyClaim: true, streakDays: true }
  });

  if (!user) throw new Error('User not found');

  if (!user.lastDailyClaim) {
    return { canClaim: true, nextClaimAt: null, currentStreak: 0, potentialReward: DAILY_REWARDS[1] };
  }

  if (isToday(user.lastDailyClaim)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return {
      canClaim: false,
      nextClaimAt: tomorrow,
      currentStreak: user.streakDays,
      potentialReward: calculateReward(Math.min(user.streakDays + 1, 5))
    };
  }

  const nextStreak = isYesterday(user.lastDailyClaim) ? user.streakDays + 1 : 1;
  return {
    canClaim: true,
    nextClaimAt: null,
    currentStreak: user.streakDays,
    potentialReward: calculateReward(nextStreak)
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    // GET /api/users/me
    if (req.method === 'GET') {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        include: {
          pokemon: {
            where: { isInTeam: true },
            include: { species: true },
            orderBy: { teamPosition: 'asc' }
          },
          _count: { select: { pokemon: true, pokedex: true } }
        }
      });

      if (!user) return res.status(404).json({ error: 'User not found' });

      // Get stats
      const [pokemonStats, tradeStats] = await Promise.all([
        prisma.userPokemon.groupBy({
          by: ['isShiny'],
          where: { userId: auth.userId },
          _count: true
        }),
        prisma.trade.count({
          where: {
            OR: [{ initiatorId: auth.userId }, { receiverId: auth.userId }],
            status: 'accepted'
          }
        })
      ]);

      const stats = {
        totalPokemon: user._count.pokemon,
        pokedexCount: user._count.pokedex,
        shinyCount: pokemonStats.find(s => s.isShiny)?._count || 0,
        tradesCompleted: tradeStats
      };

      const dailyReward = await canClaimDailyReward(auth.userId);

      return res.status(200).json({ ...user, stats, dailyReward });
    }

    // PATCH /api/users/me
    if (req.method === 'PATCH') {
      const { displayName, avatarUrl } = req.body || {};
      if (displayName !== undefined && (displayName.length < 2 || displayName.length > 30)) {
        return res.status(400).json({ error: 'Display name must be between 2 and 30 characters' });
      }

      const updateData = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      const user = await prisma.user.update({
        where: { id: auth.userId },
        data: updateData
      });

      return res.status(200).json(user);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Users/me error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
