import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    // GET - Check daily reward status
    if (req.method === 'GET') {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { lastDailyClaim: true, streakDays: true }
      });

      if (!user) return res.status(404).json({ error: 'User not found' });

      if (!user.lastDailyClaim) {
        return res.status(200).json({
          canClaim: true,
          nextClaimAt: null,
          currentStreak: 0,
          potentialReward: DAILY_REWARDS[1]
        });
      }

      if (isToday(user.lastDailyClaim)) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return res.status(200).json({
          canClaim: false,
          nextClaimAt: tomorrow,
          currentStreak: user.streakDays,
          potentialReward: calculateReward(Math.min(user.streakDays + 1, 5))
        });
      }

      const nextStreak = isYesterday(user.lastDailyClaim) ? user.streakDays + 1 : 1;
      return res.status(200).json({
        canClaim: true,
        nextClaimAt: null,
        currentStreak: user.streakDays,
        potentialReward: calculateReward(nextStreak)
      });
    }

    // POST - Claim daily reward
    if (req.method === 'POST') {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, coins: true, lastDailyClaim: true, streakDays: true }
      });

      if (!user) return res.status(404).json({ error: 'User not found' });

      if (user.lastDailyClaim && isToday(user.lastDailyClaim)) {
        return res.status(400).json({ error: 'Daily reward already claimed' });
      }

      const newStreak = (user.lastDailyClaim && isYesterday(user.lastDailyClaim))
        ? user.streakDays + 1 : 1;
      const reward = calculateReward(newStreak);

      const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: auth.userId },
          data: {
            coins: { increment: reward },
            streakDays: newStreak,
            lastDailyClaim: new Date()
          }
        });

        await tx.coinTransaction.create({
          data: {
            userId: auth.userId,
            amount: reward,
            type: 'daily_reward'
          }
        });

        return updatedUser;
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      return res.status(200).json({
        success: true,
        coinsAwarded: reward,
        newBalance: result.coins,
        streakDay: newStreak,
        nextClaimAt: tomorrow
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Daily reward error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
