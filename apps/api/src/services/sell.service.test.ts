import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SellService } from './sell.service.js';
import { PokemonRarity } from '@pokemon-marketplace/shared';

// Mock Prisma
const mockPrisma = {
  userPokemon: {
    findFirst: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  user: {
    update: vi.fn()
  },
  userPokedex: {
    update: vi.fn()
  },
  coinTransaction: {
    create: vi.fn()
  },
  $transaction: vi.fn((fn) => fn(mockPrisma))
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma
}));

vi.mock('./metrics.service.js', () => ({
  metricsService: {
    trackCoinsEarned: vi.fn()
  }
}));

describe('SellService', () => {
  let sellService: SellService;

  const mockPokemon = {
    id: 'pokemon-1',
    userId: 'user-1',
    speciesId: 25,
    isShiny: false,
    isFavorite: false,
    isInTeam: false,
    species: {
      id: 25,
      name: 'pikachu',
      rarity: PokemonRarity.COMMON,
      basePrice: 100
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sellService = new SellService();
  });

  describe('sellPokemon', () => {
    it('should throw error if Pokemon not found', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(null);

      await expect(sellService.sellPokemon('user-1', 'invalid-id'))
        .rejects.toThrow('Pokemon not found');
    });

    it('should throw error if Pokemon is favorite', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue({
        ...mockPokemon,
        isFavorite: true
      });

      await expect(sellService.sellPokemon('user-1', 'pokemon-1'))
        .rejects.toThrow('Cannot sell a favorite Pokemon');
    });

    it('should throw error if Pokemon is in team', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue({
        ...mockPokemon,
        isInTeam: true
      });

      await expect(sellService.sellPokemon('user-1', 'pokemon-1'))
        .rejects.toThrow('Cannot sell a Pokemon in your team');
    });

    it('should successfully sell Pokemon and return correct coins', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockPokemon);
      mockPrisma.userPokemon.delete.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ coins: 550 });
      mockPrisma.coinTransaction.create.mockResolvedValue({});
      mockPrisma.userPokemon.count.mockResolvedValue(1); // Still has more of this species

      const result = await sellService.sellPokemon('user-1', 'pokemon-1');

      expect(result.coinsReceived).toBe(50); // 100 * 0.5 for COMMON
      expect(result.newBalance).toBe(550);
      expect(result.speciesId).toBe(25);
      expect(result.speciesName).toBe('pikachu');
    });

    it('should update hasCurrently when selling last Pokemon of species', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockPokemon);
      mockPrisma.userPokemon.delete.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ coins: 550 });
      mockPrisma.coinTransaction.create.mockResolvedValue({});
      mockPrisma.userPokemon.count.mockResolvedValue(0); // No more of this species
      mockPrisma.userPokedex.update.mockResolvedValue({});

      await sellService.sellPokemon('user-1', 'pokemon-1');

      expect(mockPrisma.userPokedex.update).toHaveBeenCalledWith({
        where: {
          userId_speciesId: {
            userId: 'user-1',
            speciesId: 25
          }
        },
        data: {
          hasCurrently: false
        }
      });
    });

    it('should NOT update hasCurrently when user still has Pokemon of species', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockPokemon);
      mockPrisma.userPokemon.delete.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ coins: 550 });
      mockPrisma.coinTransaction.create.mockResolvedValue({});
      mockPrisma.userPokemon.count.mockResolvedValue(2); // Still has more

      await sellService.sellPokemon('user-1', 'pokemon-1');

      expect(mockPrisma.userPokedex.update).not.toHaveBeenCalled();
    });

    it('should give correct price for LEGENDARY Pokemon', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue({
        ...mockPokemon,
        species: {
          ...mockPokemon.species,
          rarity: PokemonRarity.LEGENDARY,
          basePrice: 5000
        }
      });
      mockPrisma.userPokemon.delete.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ coins: 2500 });
      mockPrisma.coinTransaction.create.mockResolvedValue({});
      mockPrisma.userPokemon.count.mockResolvedValue(1);

      const result = await sellService.sellPokemon('user-1', 'pokemon-1');

      expect(result.coinsReceived).toBe(2500); // 5000 * 0.5
    });

    it('should create coin transaction with SALE type', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockPokemon);
      mockPrisma.userPokemon.delete.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({ coins: 550 });
      mockPrisma.userPokemon.count.mockResolvedValue(1);

      await sellService.sellPokemon('user-1', 'pokemon-1');

      expect(mockPrisma.coinTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          amount: 50,
          type: 'sale',
          referenceId: 'pokemon-1'
        }
      });
    });
  });

  describe('getSellPricePreview', () => {
    it('should return canSell false if Pokemon not found', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(null);

      const result = await sellService.getSellPricePreview('user-1', 'invalid-id');

      expect(result.canSell).toBe(false);
      expect(result.reason).toBe('Pokemon not found');
    });

    it('should return canSell false if Pokemon is favorite', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue({
        ...mockPokemon,
        isFavorite: true
      });

      const result = await sellService.getSellPricePreview('user-1', 'pokemon-1');

      expect(result.canSell).toBe(false);
      expect(result.sellPrice).toBe(50);
      expect(result.reason).toBe('Cannot sell a favorite Pokemon');
    });

    it('should return canSell true with correct price', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockPokemon);

      const result = await sellService.getSellPricePreview('user-1', 'pokemon-1');

      expect(result.canSell).toBe(true);
      expect(result.sellPrice).toBe(50);
      expect(result.reason).toBeUndefined();
    });
  });
});
