import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShopService } from './shop.service.js';

// Mock Prisma
const mockPrisma = {
  shopItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  userPokemon: {
    create: vi.fn()
  },
  userPokedex: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  coinTransaction: {
    create: vi.fn()
  },
  pokemonSpecies: {
    findMany: vi.fn()
  },
  $transaction: vi.fn((fn) => fn(mockPrisma))
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma
}));

describe('ShopService', () => {
  let shopService: ShopService;

  beforeEach(() => {
    vi.clearAllMocks();
    shopService = new ShopService();
  });

  describe('getShopItems', () => {
    it('should return active shop items', async () => {
      const mockItems = [
        {
          id: 'item-1',
          name: 'Basic Egg',
          itemType: 'egg',
          price: 100,
          isActive: true,
          eggCategory: 'basic'
        },
        {
          id: 'item-2',
          name: 'Premium Egg',
          itemType: 'egg',
          price: 500,
          isActive: true,
          eggCategory: 'premium'
        }
      ];

      mockPrisma.shopItem.findMany.mockResolvedValue(mockItems);

      const result = await shopService.getShopItems();

      expect(result).toEqual(mockItems);
      expect(mockPrisma.shopItem.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { species: true },
        orderBy: [{ itemType: 'asc' }, { price: 'asc' }]
      });
    });
  });

  describe('purchaseItem', () => {
    const mockUser = {
      id: 'user-1',
      coins: 1000
    };

    const mockEggItem = {
      id: 'egg-1',
      name: 'Basic Egg',
      itemType: 'egg',
      price: 100,
      isActive: true,
      eggCategory: 'basic',
      stock: null,
      speciesId: null
    };

    const mockPokemonItem = {
      id: 'pokemon-1',
      name: 'Pikachu',
      itemType: 'pokemon',
      price: 500,
      isActive: true,
      speciesId: 25,
      stock: 10,
      species: { id: 25, name: 'pikachu' }
    };

    beforeEach(() => {
      // Setup default mocks
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, coins: 900 });
      mockPrisma.userPokedex.findUnique.mockResolvedValue(null);
      mockPrisma.coinTransaction.create.mockResolvedValue({});
      mockPrisma.pokemonSpecies.findMany.mockResolvedValue([
        { id: 1 }, { id: 4 }, { id: 7 }
      ]);
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(shopService.purchaseItem('unknown', 'item-1'))
        .rejects.toThrow('User not found');
    });

    it('should throw error if item not found', async () => {
      mockPrisma.shopItem.findUnique.mockResolvedValue(null);

      await expect(shopService.purchaseItem('user-1', 'unknown'))
        .rejects.toThrow('Item not available');
    });

    it('should throw error if item is inactive', async () => {
      mockPrisma.shopItem.findUnique.mockResolvedValue({
        ...mockEggItem,
        isActive: false
      });

      await expect(shopService.purchaseItem('user-1', 'egg-1'))
        .rejects.toThrow('Item not available');
    });

    it('should throw error if insufficient coins', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, coins: 50 });
      mockPrisma.shopItem.findUnique.mockResolvedValue(mockEggItem);

      await expect(shopService.purchaseItem('user-1', 'egg-1'))
        .rejects.toThrow('Insufficient coins');
    });

    it('should throw error if item out of stock', async () => {
      mockPrisma.shopItem.findUnique.mockResolvedValue({
        ...mockPokemonItem,
        stock: 0
      });

      await expect(shopService.purchaseItem('user-1', 'pokemon-1'))
        .rejects.toThrow('Item out of stock');
    });

    it('should successfully purchase a direct pokemon', async () => {
      mockPrisma.shopItem.findUnique.mockResolvedValue(mockPokemonItem);

      const mockCreatedPokemon = {
        id: 'pokemon-instance-1',
        speciesId: 25,
        isShiny: false,
        species: { id: 25, name: 'pikachu' }
      };

      mockPrisma.userPokemon.create.mockResolvedValue(mockCreatedPokemon);

      const result = await shopService.purchaseItem('user-1', 'pokemon-1');

      expect(result).toHaveProperty('pokemon');
      expect(result).toHaveProperty('newBalance');
      expect(result).toHaveProperty('isNewPokedexEntry');
      expect(result.isNewPokedexEntry).toBe(true);
    });

    it('should create pokedex entry for new pokemon', async () => {
      mockPrisma.shopItem.findUnique.mockResolvedValue(mockPokemonItem);
      mockPrisma.userPokedex.findUnique.mockResolvedValue(null);
      mockPrisma.userPokemon.create.mockResolvedValue({
        id: 'pokemon-instance-1',
        speciesId: 25,
        isShiny: false,
        species: { id: 25, name: 'pikachu' }
      });

      await shopService.purchaseItem('user-1', 'pokemon-1');

      expect(mockPrisma.userPokedex.create).toHaveBeenCalled();
    });

    it('should update pokedex entry for existing pokemon', async () => {
      mockPrisma.shopItem.findUnique.mockResolvedValue(mockPokemonItem);
      mockPrisma.userPokedex.findUnique.mockResolvedValue({
        userId: 'user-1',
        speciesId: 25,
        timesObtained: 1
      });
      mockPrisma.userPokemon.create.mockResolvedValue({
        id: 'pokemon-instance-1',
        speciesId: 25,
        isShiny: false,
        species: { id: 25, name: 'pikachu' }
      });

      const result = await shopService.purchaseItem('user-1', 'pokemon-1');

      expect(result.isNewPokedexEntry).toBe(false);
      expect(mockPrisma.userPokedex.update).toHaveBeenCalled();
    });

    it('should decrement stock for limited items', async () => {
      mockPrisma.shopItem.findUnique.mockResolvedValue(mockPokemonItem);
      mockPrisma.userPokemon.create.mockResolvedValue({
        id: 'pokemon-instance-1',
        speciesId: 25,
        isShiny: false,
        species: { id: 25, name: 'pikachu' }
      });

      await shopService.purchaseItem('user-1', 'pokemon-1');

      expect(mockPrisma.shopItem.update).toHaveBeenCalledWith({
        where: { id: 'pokemon-1' },
        data: { stock: { decrement: 1 } }
      });
    });
  });
});
