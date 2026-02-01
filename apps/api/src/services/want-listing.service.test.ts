import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WantListingService } from './want-listing.service.js';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    pokemonSpecies: {
      findUnique: vi.fn(),
    },
    userPokemon: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    wantListing: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    wantListingPokemon: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    counterOffer: {
      updateMany: vi.fn(),
    },
    userPokedex: {
      upsert: vi.fn(),
    },
    coinTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      wantListing: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      userPokemon: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
      counterOffer: {
        updateMany: vi.fn(),
      },
      userPokedex: {
        upsert: vi.fn(),
      },
      coinTransaction: {
        create: vi.fn(),
      },
    })),
  },
}));

import { prisma } from '../lib/prisma.js';

describe('WantListingService', () => {
  let service: WantListingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WantListingService();
  });

  describe('createListing', () => {
    it('should create listing with valid data', async () => {
      const userId = 'user-1';
      const data = {
        wantedSpeciesId: 25, // Pikachu
        wantShiny: false,
        coinsOffered: 100,
        offeredPokemonIds: ['pokemon-1'],
      };

      // Mock species exists
      vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
        id: 25,
        name: 'pikachu',
      } as any);

      // Mock user owns Pokemon
      vi.mocked(prisma.userPokemon.findMany).mockResolvedValue([
        { id: 'pokemon-1', userId },
      ] as any);

      // Mock no active listings with this Pokemon
      vi.mocked(prisma.wantListingPokemon.findFirst).mockResolvedValue(null);

      // Mock user has enough coins
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        coins: 500,
      } as any);

      // Mock listing creation
      vi.mocked(prisma.wantListing.create).mockResolvedValue({
        id: 'listing-1',
        userId,
        wantedSpeciesId: 25,
        wantShiny: false,
        coinsOffered: 100,
        status: 'open',
      } as any);

      const result = await service.createListing(userId, data);

      expect(prisma.pokemonSpecies.findUnique).toHaveBeenCalledWith({
        where: { id: 25 },
      });
      expect(prisma.wantListing.create).toHaveBeenCalled();
      expect(result.id).toBe('listing-1');
    });

    it('should throw error for invalid species', async () => {
      vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue(null);

      await expect(
        service.createListing('user-1', {
          wantedSpeciesId: 9999,
          coinsOffered: 100,
          offeredPokemonIds: [],
        })
      ).rejects.toThrow('Invalid species ID');
    });

    it('should throw error when user does not own offered Pokemon', async () => {
      vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
        id: 25,
      } as any);

      vi.mocked(prisma.userPokemon.findMany).mockResolvedValue([]); // No matching Pokemon

      await expect(
        service.createListing('user-1', {
          wantedSpeciesId: 25,
          coinsOffered: 0,
          offeredPokemonIds: ['pokemon-1'],
        })
      ).rejects.toThrow('You do not own all the offered Pokemon');
    });

    it('should throw error when Pokemon is in active listing', async () => {
      vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
        id: 25,
      } as any);

      vi.mocked(prisma.userPokemon.findMany).mockResolvedValue([
        { id: 'pokemon-1', userId: 'user-1' },
      ] as any);

      vi.mocked(prisma.wantListingPokemon.findFirst).mockResolvedValue({
        id: 'existing',
      } as any);

      await expect(
        service.createListing('user-1', {
          wantedSpeciesId: 25,
          coinsOffered: 0,
          offeredPokemonIds: ['pokemon-1'],
        })
      ).rejects.toThrow('One or more Pokemon are already in an active listing');
    });

    it('should throw error when user has insufficient coins', async () => {
      vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
        id: 25,
      } as any);

      vi.mocked(prisma.userPokemon.findMany).mockResolvedValue([]);
      vi.mocked(prisma.wantListingPokemon.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        coins: 50,
      } as any);

      await expect(
        service.createListing('user-1', {
          wantedSpeciesId: 25,
          coinsOffered: 100,
          offeredPokemonIds: [],
        })
      ).rejects.toThrow('Insufficient coins');
    });

    it('should throw error when no offer is provided', async () => {
      vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
        id: 25,
      } as any);

      vi.mocked(prisma.userPokemon.findMany).mockResolvedValue([]);
      vi.mocked(prisma.wantListingPokemon.findFirst).mockResolvedValue(null);

      await expect(
        service.createListing('user-1', {
          wantedSpeciesId: 25,
          coinsOffered: 0,
          offeredPokemonIds: [],
        })
      ).rejects.toThrow('Must offer coins or Pokemon');
    });
  });

  describe('cancelListing', () => {
    it('should cancel listing for owner', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-1',
        status: 'open',
      } as any);

      vi.mocked(prisma.$transaction).mockResolvedValue(undefined);

      await service.cancelListing('user-1', 'listing-1');

      expect(prisma.wantListing.findUnique).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error for non-owner', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-2',
        status: 'open',
      } as any);

      await expect(
        service.cancelListing('user-1', 'listing-1')
      ).rejects.toThrow('Not authorized to cancel this listing');
    });

    it('should throw error for non-open listing', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-1',
        status: 'completed',
      } as any);

      await expect(
        service.cancelListing('user-1', 'listing-1')
      ).rejects.toThrow('Listing is not open');
    });
  });

  describe('getListings', () => {
    it('should return paginated listings', async () => {
      vi.mocked(prisma.wantListing.findMany).mockResolvedValue([
        { id: 'listing-1' },
        { id: 'listing-2' },
      ] as any);

      vi.mocked(prisma.wantListing.count).mockResolvedValue(2);

      const result = await service.getListings({ page: 1, pageSize: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by species', async () => {
      vi.mocked(prisma.wantListing.findMany).mockResolvedValue([]);
      vi.mocked(prisma.wantListing.count).mockResolvedValue(0);

      await service.getListings({ speciesId: 25 });

      expect(prisma.wantListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wantedSpeciesId: 25,
          }),
        })
      );
    });
  });
});
