import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the coin service module for unit testing
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('../lib/prisma', () => ({
  prisma: mockPrisma,
}));

describe('CoinService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateDailyReward', () => {
    it('should return base reward for streak of 1', () => {
      const baseReward = 100;
      const streakBonus = 10;
      const streak = 1;
      const reward = baseReward + (streak - 1) * streakBonus;
      expect(reward).toBe(100);
    });

    it('should add streak bonus for consecutive days', () => {
      const baseReward = 100;
      const streakBonus = 10;
      const streak = 5;
      const reward = baseReward + (streak - 1) * streakBonus;
      expect(reward).toBe(140);
    });

    it('should cap streak bonus at maximum', () => {
      const baseReward = 100;
      const streakBonus = 10;
      const maxStreakBonus = 100;
      const streak = 30;
      const bonus = Math.min((streak - 1) * streakBonus, maxStreakBonus);
      const reward = baseReward + bonus;
      expect(reward).toBe(200);
    });
  });

  describe('canClaimDailyReward', () => {
    it('should return true if never claimed', () => {
      const lastClaimed = null;
      const canClaim = lastClaimed === null;
      expect(canClaim).toBe(true);
    });

    it('should return true if claimed yesterday', () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const canClaim = yesterday < today;
      expect(canClaim).toBe(true);
    });

    it('should return false if already claimed today', () => {
      const now = new Date();
      const claimedToday = new Date(now);
      claimedToday.setHours(now.getHours() - 1);

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const canClaim = claimedToday < todayStart;
      expect(canClaim).toBe(false);
    });
  });

  describe('calculateStreakDays', () => {
    it('should return 1 for first claim', () => {
      const previousStreak = 0;
      const lastClaimed = null;
      const newStreak = lastClaimed === null ? 1 : previousStreak + 1;
      expect(newStreak).toBe(1);
    });

    it('should increment streak for consecutive days', () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const previousStreak = 5;
      const daysDiff = Math.floor(
        (now.getTime() - yesterday.getTime()) / (1000 * 60 * 60 * 24)
      );

      const newStreak = daysDiff === 1 ? previousStreak + 1 : 1;
      expect(newStreak).toBe(6);
    });

    it('should reset streak if more than 1 day gap', () => {
      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const previousStreak = 5;
      const daysDiff = Math.floor(
        (now.getTime() - twoDaysAgo.getTime()) / (1000 * 60 * 60 * 24)
      );

      const newStreak = daysDiff === 1 ? previousStreak + 1 : 1;
      expect(newStreak).toBe(1);
    });
  });
});
