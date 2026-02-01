import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CounterOfferService } from './counter-offer.service.js';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    wantListing: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userPokemon: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    counterOffer: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    userPokedex: {
      upsert: vi.fn(),
    },
    coinTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      counterOffer: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      wantListing: {
        update: vi.fn(),
      },
      userPokemon: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
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

describe('CounterOfferService', () => {
  let service: CounterOfferService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CounterOfferService();
  });

  describe('createCounterOffer', () => {
    it('should create counter-offer with valid data', async () => {
      const userId = 'user-2';
      const data = {
        wantListingId: 'listing-1',
        offeredPokemonId: 'pokemon-1',
        coinsRequested: 50,
        requestedPokemonIds: [],
      };

      // Mock listing exists and is open
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-1',
        status: 'open',
        wantedSpeciesId: 25,
        wantShiny: false,
        offeredPokemon: [],
      } as any);

      // Mock user owns the Pokemon
      vi.mocked(prisma.userPokemon.findUnique).mockResolvedValue({
        id: 'pokemon-1',
        userId: 'user-2',
        speciesId: 25,
        isShiny: false,
        species: { id: 25, name: 'pikachu' },
      } as any);

      // Mock no existing counter-offer
      vi.mocked(prisma.counterOffer.findFirst).mockResolvedValue(null);

      // Mock counter-offer creation
      vi.mocked(prisma.counterOffer.create).mockResolvedValue({
        id: 'counter-offer-1',
        wantListingId: 'listing-1',
        userId: 'user-2',
        offeredPokemonId: 'pokemon-1',
        coinsRequested: 50,
        status: 'pending',
      } as any);

      const result = await service.createCounterOffer(userId, data);

      expect(prisma.wantListing.findUnique).toHaveBeenCalled();
      expect(prisma.counterOffer.create).toHaveBeenCalled();
      expect(result.id).toBe('counter-offer-1');
    });

    it('should throw error when listing not found', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue(null);

      await expect(
        service.createCounterOffer('user-2', {
          wantListingId: 'invalid',
          offeredPokemonId: 'pokemon-1',
          coinsRequested: 50,
          requestedPokemonIds: [],
        })
      ).rejects.toThrow('Listing not found');
    });

    it('should throw error when making offer on own listing', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-1',
        status: 'open',
        offeredPokemon: [],
      } as any);

      await expect(
        service.createCounterOffer('user-1', {
          wantListingId: 'listing-1',
          offeredPokemonId: 'pokemon-1',
          coinsRequested: 50,
          requestedPokemonIds: [],
        })
      ).rejects.toThrow('Cannot make counter-offer on your own listing');
    });

    it('should throw error when listing is not open', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-1',
        status: 'completed',
        offeredPokemon: [],
      } as any);

      await expect(
        service.createCounterOffer('user-2', {
          wantListingId: 'listing-1',
          offeredPokemonId: 'pokemon-1',
          coinsRequested: 50,
          requestedPokemonIds: [],
        })
      ).rejects.toThrow('Listing is not open');
    });

    it('should throw error when user does not own offered Pokemon', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-1',
        status: 'open',
        wantedSpeciesId: 25,
        wantShiny: false,
        offeredPokemon: [],
      } as any);

      vi.mocked(prisma.userPokemon.findUnique).mockResolvedValue({
        id: 'pokemon-1',
        userId: 'user-3', // Different user
        speciesId: 25,
      } as any);

      await expect(
        service.createCounterOffer('user-2', {
          wantListingId: 'listing-1',
          offeredPokemonId: 'pokemon-1',
          coinsRequested: 50,
          requestedPokemonIds: [],
        })
      ).rejects.toThrow('You do not own this Pokemon');
    });

    it('should throw error when Pokemon does not match wanted species', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-1',
        status: 'open',
        wantedSpeciesId: 25, // Pikachu
        wantShiny: false,
        offeredPokemon: [],
      } as any);

      vi.mocked(prisma.userPokemon.findUnique).mockResolvedValue({
        id: 'pokemon-1',
        userId: 'user-2',
        speciesId: 1, // Bulbasaur - wrong species
        species: { id: 1, name: 'bulbasaur' },
      } as any);

      await expect(
        service.createCounterOffer('user-2', {
          wantListingId: 'listing-1',
          offeredPokemonId: 'pokemon-1',
          coinsRequested: 50,
          requestedPokemonIds: [],
        })
      ).rejects.toThrow('Pokemon does not match wanted species');
    });

    it('should throw error when user already has pending counter-offer', async () => {
      vi.mocked(prisma.wantListing.findUnique).mockResolvedValue({
        id: 'listing-1',
        userId: 'user-1',
        status: 'open',
        wantedSpeciesId: 25,
        wantShiny: false,
        offeredPokemon: [],
      } as any);

      vi.mocked(prisma.userPokemon.findUnique).mockResolvedValue({
        id: 'pokemon-1',
        userId: 'user-2',
        speciesId: 25,
        isShiny: false,
        species: { id: 25 },
      } as any);

      vi.mocked(prisma.counterOffer.findFirst).mockResolvedValue({
        id: 'existing-offer',
      } as any);

      await expect(
        service.createCounterOffer('user-2', {
          wantListingId: 'listing-1',
          offeredPokemonId: 'pokemon-1',
          coinsRequested: 50,
          requestedPokemonIds: [],
        })
      ).rejects.toThrow('You already have a pending counter-offer on this listing');
    });
  });

  describe('rejectCounterOffer', () => {
    it('should reject counter-offer for listing owner', async () => {
      vi.mocked(prisma.counterOffer.findUnique).mockResolvedValue({
        id: 'counter-offer-1',
        userId: 'user-2',
        status: 'pending',
        wantListing: { userId: 'user-1' },
      } as any);

      vi.mocked(prisma.counterOffer.update).mockResolvedValue({
        id: 'counter-offer-1',
        status: 'rejected',
      } as any);

      await service.rejectCounterOffer('user-1', 'counter-offer-1');

      expect(prisma.counterOffer.update).toHaveBeenCalledWith({
        where: { id: 'counter-offer-1' },
        data: { status: 'rejected' },
      });
    });

    it('should throw error for non-owner', async () => {
      vi.mocked(prisma.counterOffer.findUnique).mockResolvedValue({
        id: 'counter-offer-1',
        userId: 'user-2',
        status: 'pending',
        wantListing: { userId: 'user-1' },
      } as any);

      await expect(
        service.rejectCounterOffer('user-3', 'counter-offer-1')
      ).rejects.toThrow('Only the listing owner can reject counter-offers');
    });
  });

  describe('withdrawCounterOffer', () => {
    it('should withdraw counter-offer for creator', async () => {
      vi.mocked(prisma.counterOffer.findUnique).mockResolvedValue({
        id: 'counter-offer-1',
        userId: 'user-2',
        status: 'pending',
      } as any);

      vi.mocked(prisma.counterOffer.update).mockResolvedValue({
        id: 'counter-offer-1',
        status: 'withdrawn',
      } as any);

      await service.withdrawCounterOffer('user-2', 'counter-offer-1');

      expect(prisma.counterOffer.update).toHaveBeenCalledWith({
        where: { id: 'counter-offer-1' },
        data: { status: 'withdrawn' },
      });
    });

    it('should throw error for non-creator', async () => {
      vi.mocked(prisma.counterOffer.findUnique).mockResolvedValue({
        id: 'counter-offer-1',
        userId: 'user-2',
        status: 'pending',
      } as any);

      await expect(
        service.withdrawCounterOffer('user-1', 'counter-offer-1')
      ).rejects.toThrow('Only the counter-offer creator can withdraw it');
    });
  });

  describe('getCounterOffers', () => {
    it('should return counter-offers for listing', async () => {
      vi.mocked(prisma.counterOffer.findMany).mockResolvedValue([
        { id: 'counter-offer-1' },
        { id: 'counter-offer-2' },
      ] as any);

      const result = await service.getCounterOffers('listing-1');

      expect(result).toHaveLength(2);
      expect(prisma.counterOffer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wantListingId: 'listing-1' },
        })
      );
    });
  });

  describe('getUserCounterOffers', () => {
    it('should return counter-offers by user', async () => {
      vi.mocked(prisma.counterOffer.findMany).mockResolvedValue([
        { id: 'counter-offer-1' },
      ] as any);

      const result = await service.getUserCounterOffers('user-2');

      expect(result).toHaveLength(1);
      expect(prisma.counterOffer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-2' },
        })
      );
    });
  });
});
