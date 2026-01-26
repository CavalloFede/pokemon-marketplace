import { prisma } from '../lib/prisma.js';
import {
  CoinTransactionType,
  DAILY_REWARDS,
  MAX_DAILY_REWARD,
  INITIAL_COINS
} from '@pokemon-marketplace/shared';

/**
 * Check if a date is today
 */
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is yesterday
 */
function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * Calculate reward based on streak day
 */
function calculateReward(streakDay: number): number {
  if (streakDay >= 5) return MAX_DAILY_REWARD;
  return DAILY_REWARDS[streakDay as keyof typeof DAILY_REWARDS] || DAILY_REWARDS[1];
}

export class CoinService {
  /**
   * Get user's coin balance
   */
  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true }
    });

    return user?.coins ?? 0;
  }

  /**
   * Check if user can claim daily reward
   */
  async canClaimDailyReward(userId: string): Promise<{
    canClaim: boolean;
    nextClaimAt: Date | null;
    currentStreak: number;
    potentialReward: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        lastDailyClaim: true,
        streakDays: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // If never claimed, can claim
    if (!user.lastDailyClaim) {
      return {
        canClaim: true,
        nextClaimAt: null,
        currentStreak: 0,
        potentialReward: DAILY_REWARDS[1]
      };
    }

    // If already claimed today, can't claim
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

    // Calculate next streak
    let nextStreak: number;
    if (isYesterday(user.lastDailyClaim)) {
      nextStreak = user.streakDays + 1;
    } else {
      nextStreak = 1; // Reset streak
    }

    return {
      canClaim: true,
      nextClaimAt: null,
      currentStreak: user.streakDays,
      potentialReward: calculateReward(nextStreak)
    };
  }

  /**
   * Claim daily reward
   */
  async claimDailyReward(userId: string): Promise<{
    coinsAwarded: number;
    newBalance: number;
    streakDay: number;
    nextClaimAt: Date;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        coins: true,
        lastDailyClaim: true,
        streakDays: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already claimed today
    if (user.lastDailyClaim && isToday(user.lastDailyClaim)) {
      throw new Error('Daily reward already claimed');
    }

    // Calculate new streak
    let newStreak: number;
    if (user.lastDailyClaim && isYesterday(user.lastDailyClaim)) {
      newStreak = user.streakDays + 1;
    } else {
      newStreak = 1;
    }

    // Calculate reward
    const reward = calculateReward(newStreak);

    // Update user and create transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: { increment: reward },
          streakDays: newStreak,
          lastDailyClaim: new Date()
        }
      });

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: reward,
          type: CoinTransactionType.DAILY_REWARD
        }
      });

      return updatedUser;
    });

    // Calculate next claim time (tomorrow at midnight)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      coinsAwarded: reward,
      newBalance: result.coins,
      streakDay: newStreak,
      nextClaimAt: tomorrow
    };
  }

  /**
   * Add coins to user (for trades, events, etc.)
   */
  async addCoins(
    userId: string,
    amount: number,
    type: CoinTransactionType,
    referenceId?: string
  ): Promise<number> {
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: amount } }
      });

      await tx.coinTransaction.create({
        data: {
          userId,
          amount,
          type,
          referenceId
        }
      });

      return updatedUser.coins;
    });

    return result;
  }

  /**
   * Deduct coins from user
   */
  async deductCoins(
    userId: string,
    amount: number,
    type: CoinTransactionType,
    referenceId?: string
  ): Promise<number> {
    // Check balance first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true }
    });

    if (!user || user.coins < amount) {
      throw new Error('Insufficient coins');
    }

    return this.addCoins(userId, -amount, type, referenceId);
  }

  /**
   * Transfer coins between users (for trades)
   */
  async transferCoins(
    fromUserId: string,
    toUserId: string,
    amount: number,
    referenceId?: string
  ): Promise<void> {
    if (amount <= 0) return;

    await prisma.$transaction(async (tx) => {
      // Check sender balance
      const sender = await tx.user.findUnique({
        where: { id: fromUserId },
        select: { coins: true }
      });

      if (!sender || sender.coins < amount) {
        throw new Error('Insufficient coins');
      }

      // Deduct from sender
      await tx.user.update({
        where: { id: fromUserId },
        data: { coins: { decrement: amount } }
      });

      await tx.coinTransaction.create({
        data: {
          userId: fromUserId,
          amount: -amount,
          type: CoinTransactionType.TRADE_SENT,
          referenceId
        }
      });

      // Add to receiver
      await tx.user.update({
        where: { id: toUserId },
        data: { coins: { increment: amount } }
      });

      await tx.coinTransaction.create({
        data: {
          userId: toUserId,
          amount,
          type: CoinTransactionType.TRADE_RECEIVED,
          referenceId
        }
      });
    });
  }
}

export const coinService = new CoinService();
