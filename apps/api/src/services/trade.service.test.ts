import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeService } from './trade.service.js';
import { TradeStatus } from '@pokemon-marketplace/shared';

// Mock Prisma
const mockPrisma = {
  trade: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  },
  userPokemon: {
    findMany: vi.fn(),
    updateMany: vi.fn()
  },
  userPokedex: {
    upsert: vi.fn()
  },
  $transaction: vi.fn((fn) => fn(mockPrisma))
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma
}));

vi.mock('./coin.service.js', () => ({
  coinService: {
    transferCoins: vi.fn()
  }
}));

describe('TradeService', () => {
  let tradeService: TradeService;

  beforeEach(() => {
    vi.clearAllMocks();
    tradeService = new TradeService();
  });

  describe('createTrade', () => {
    const mockInput = {
      receiverId: 'user-2',
      initiatorPokemonIds: ['pokemon-1'],
      receiverPokemonIds: ['pokemon-2'],
      coinsOffered: 0
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrisma.userPokemon.findMany
        .mockResolvedValueOnce([{ id: 'pokemon-1', userId: 'user-1' }])
        .mockResolvedValueOnce([{ id: 'pokemon-2', userId: 'user-2' }]);
      mockPrisma.trade.findMany.mockResolvedValue([]);
      mockPrisma.trade.create.mockResolvedValue({ id: 'trade-1' });
      mockPrisma.trade.findUnique.mockResolvedValue({
        id: 'trade-1',
        initiatorId: 'user-1',
        receiverId: 'user-2',
        status: TradeStatus.PENDING
      });
    });

    it('should throw error when trading with yourself', async () => {
      await expect(
        tradeService.createTrade('user-1', {
          ...mockInput,
          receiverId: 'user-1'
        })
      ).rejects.toThrow('Cannot trade with yourself');
    });

    it('should throw error when receiver not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(tradeService.createTrade('user-1', mockInput))
        .rejects.toThrow('Receiver not found');
    });

    it('should throw error when initiator does not own pokemon', async () => {
      mockPrisma.userPokemon.findMany
        .mockReset()
        .mockResolvedValueOnce([]) // No pokemon found for initiator
        .mockResolvedValueOnce([{ id: 'pokemon-2', userId: 'user-2' }]);

      await expect(tradeService.createTrade('user-1', mockInput))
        .rejects.toThrow('Some Pokemon do not belong to you');
    });

    it('should throw error when receiver does not own requested pokemon', async () => {
      mockPrisma.userPokemon.findMany
        .mockReset()
        .mockResolvedValueOnce([{ id: 'pokemon-1', userId: 'user-1' }])
        .mockResolvedValueOnce([]); // No pokemon found for receiver

      await expect(tradeService.createTrade('user-1', mockInput))
        .rejects.toThrow('Some requested Pokemon do not belong to receiver');
    });

    it('should throw error when pokemon are in active trades', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([{ id: 'existing-trade' }]);

      await expect(tradeService.createTrade('user-1', mockInput))
        .rejects.toThrow('Some Pokemon are already in an active trade');
    });

    it('should throw error when insufficient coins offered', async () => {
      mockPrisma.user.findUnique
        .mockReset()
        .mockResolvedValueOnce({ id: 'user-2' }) // receiver exists
        .mockResolvedValueOnce({ id: 'user-1', coins: 50 }); // initiator coins

      await expect(
        tradeService.createTrade('user-1', {
          ...mockInput,
          coinsOffered: 100
        })
      ).rejects.toThrow('Insufficient coins');
    });

    it('should successfully create a trade', async () => {
      const result = await tradeService.createTrade('user-1', mockInput);

      expect(mockPrisma.trade.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });
  });

  describe('acceptTrade', () => {
    const mockTrade = {
      id: 'trade-1',
      initiatorId: 'user-1',
      receiverId: 'user-2',
      initiatorPokemonIds: ['pokemon-1'],
      receiverPokemonIds: ['pokemon-2'],
      coinsOffered: 0,
      status: TradeStatus.PENDING,
      expiresAt: new Date(Date.now() + 86400000) // 1 day from now
    };

    beforeEach(() => {
      mockPrisma.trade.findUnique.mockResolvedValue(mockTrade);
      mockPrisma.userPokemon.findMany.mockResolvedValue([
        { userId: 'user-1', speciesId: 1 },
        { userId: 'user-2', speciesId: 2 }
      ]);
    });

    it('should throw error when trade not found', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);

      await expect(tradeService.acceptTrade('trade-1', 'user-2'))
        .rejects.toThrow('Trade not found');
    });

    it('should throw error when user is not receiver', async () => {
      await expect(tradeService.acceptTrade('trade-1', 'user-1'))
        .rejects.toThrow('Only the receiver can accept this trade');
    });

    it('should throw error when trade is not pending', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        ...mockTrade,
        status: TradeStatus.ACCEPTED
      });

      await expect(tradeService.acceptTrade('trade-1', 'user-2'))
        .rejects.toThrow('Trade is not pending');
    });

    it('should throw error when trade has expired', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        ...mockTrade,
        expiresAt: new Date(Date.now() - 1000) // expired
      });

      await expect(tradeService.acceptTrade('trade-1', 'user-2'))
        .rejects.toThrow('Trade has expired');
    });

    it('should successfully accept a trade', async () => {
      await tradeService.acceptTrade('trade-1', 'user-2');

      expect(mockPrisma.userPokemon.updateMany).toHaveBeenCalled();
      expect(mockPrisma.trade.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'trade-1' },
          data: expect.objectContaining({
            status: TradeStatus.ACCEPTED
          })
        })
      );
    });
  });

  describe('rejectTrade', () => {
    it('should throw error when trade not found', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);

      await expect(tradeService.rejectTrade('trade-1', 'user-2'))
        .rejects.toThrow('Trade not found');
    });

    it('should throw error when user is not receiver', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        id: 'trade-1',
        receiverId: 'user-2',
        status: TradeStatus.PENDING
      });

      await expect(tradeService.rejectTrade('trade-1', 'user-1'))
        .rejects.toThrow('Only the receiver can reject this trade');
    });

    it('should successfully reject a trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        id: 'trade-1',
        initiatorId: 'user-1',
        receiverId: 'user-2',
        initiatorPokemonIds: [],
        receiverPokemonIds: [],
        status: TradeStatus.PENDING
      });

      await tradeService.rejectTrade('trade-1', 'user-2');

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: 'trade-1' },
        data: { status: TradeStatus.REJECTED }
      });
    });
  });

  describe('cancelTrade', () => {
    it('should throw error when user is not initiator', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        id: 'trade-1',
        initiatorId: 'user-1',
        status: TradeStatus.PENDING
      });

      await expect(tradeService.cancelTrade('trade-1', 'user-2'))
        .rejects.toThrow('Only the initiator can cancel this trade');
    });

    it('should successfully cancel a trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        id: 'trade-1',
        initiatorId: 'user-1',
        receiverId: 'user-2',
        initiatorPokemonIds: [],
        receiverPokemonIds: [],
        status: TradeStatus.PENDING
      });

      await tradeService.cancelTrade('trade-1', 'user-1');

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: 'trade-1' },
        data: { status: TradeStatus.CANCELLED }
      });
    });
  });

  describe('expireOldTrades', () => {
    it('should expire trades past their expiration date', async () => {
      mockPrisma.trade.updateMany.mockResolvedValue({ count: 5 });

      const result = await tradeService.expireOldTrades();

      expect(result).toBe(5);
      expect(mockPrisma.trade.updateMany).toHaveBeenCalledWith({
        where: {
          status: TradeStatus.PENDING,
          expiresAt: { lt: expect.any(Date) }
        },
        data: { status: TradeStatus.EXPIRED }
      });
    });
  });
});
