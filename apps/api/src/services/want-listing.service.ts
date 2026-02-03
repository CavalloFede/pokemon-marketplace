import { prisma } from '../lib/prisma.js';
import { WantListingStatus, CounterOfferStatus, ObtainedMethod, CoinTransactionType } from '../../generated/prisma/index.js';

interface CreateListingData {
  wantedSpeciesId: number;
  wantShiny?: boolean;
  coinsOffered: number;
  offeredPokemonIds: string[];
  expiresInDays?: number;
}

interface GetListingsParams {
  speciesId?: number;
  minCoins?: number;
  maxCoins?: number;
  page?: number;
  pageSize?: number;
  excludeUserId?: string;
}

interface UpdateListingData {
  coinsOffered?: number;
  offeredPokemonIds?: string[];
}

export class WantListingService {
  /**
   * Create a new want listing
   */
  async createListing(userId: string, data: CreateListingData) {
    // Validate species exists
    const species = await prisma.pokemonSpecies.findUnique({
      where: { id: data.wantedSpeciesId }
    });

    if (!species) {
      throw new Error('Invalid species ID');
    }

    // Validate user owns all offered Pokemon
    if (data.offeredPokemonIds.length > 0) {
      const ownedPokemon = await prisma.userPokemon.findMany({
        where: {
          id: { in: data.offeredPokemonIds },
          userId
        }
      });

      if (ownedPokemon.length !== data.offeredPokemonIds.length) {
        throw new Error('You do not own all the offered Pokemon');
      }

      // Check Pokemon are not in active listings or trades
      const inActiveListing = await prisma.wantListingPokemon.findFirst({
        where: {
          pokemonId: { in: data.offeredPokemonIds },
          wantListing: { status: 'open' }
        }
      });

      if (inActiveListing) {
        throw new Error('One or more Pokemon are already in an active listing');
      }
    }

    // Validate user has enough coins if offering coins
    if (data.coinsOffered > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true }
      });

      if (!user || user.coins < data.coinsOffered) {
        throw new Error('Insufficient coins');
      }
    }

    // Must offer something (coins or Pokemon)
    if (data.coinsOffered <= 0 && data.offeredPokemonIds.length === 0) {
      throw new Error('Must offer coins or Pokemon');
    }

    // Calculate expiration date
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Create listing with offered Pokemon
    const listing = await prisma.wantListing.create({
      data: {
        userId,
        wantedSpeciesId: data.wantedSpeciesId,
        wantShiny: data.wantShiny ?? false,
        coinsOffered: data.coinsOffered,
        expiresAt,
        offeredPokemon: {
          create: data.offeredPokemonIds.map(pokemonId => ({ pokemonId }))
        }
      },
      include: {
        wantedSpecies: true,
        user: {
          select: { id: true, displayName: true, avatarUrl: true }
        },
        offeredPokemon: {
          include: {
            pokemon: {
              include: { species: true }
            }
          }
        }
      }
    });

    return listing;
  }

  /**
   * Get all open listings with optional filters
   */
  async getListings(params: GetListingsParams = {}) {
    const {
      speciesId,
      minCoins,
      maxCoins,
      page = 1,
      pageSize = 20,
      excludeUserId
    } = params;

    const where: any = {
      status: 'open',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    };

    if (speciesId) {
      where.wantedSpeciesId = speciesId;
    }

    if (minCoins !== undefined) {
      where.coinsOffered = { ...where.coinsOffered, gte: minCoins };
    }

    if (maxCoins !== undefined) {
      where.coinsOffered = { ...where.coinsOffered, lte: maxCoins };
    }

    if (excludeUserId) {
      where.userId = { not: excludeUserId };
    }

    const [data, total] = await Promise.all([
      prisma.wantListing.findMany({
        where,
        include: {
          wantedSpecies: true,
          user: {
            select: { id: true, displayName: true, avatarUrl: true }
          },
          offeredPokemon: {
            include: {
              pokemon: {
                include: { species: true }
              }
            }
          },
          _count: {
            select: { counterOffers: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.wantListing.count({ where })
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Get listings by user
   */
  async getUserListings(userId: string) {
    return prisma.wantListing.findMany({
      where: { userId },
      include: {
        wantedSpecies: true,
        offeredPokemon: {
          include: {
            pokemon: {
              include: { species: true }
            }
          }
        },
        counterOffers: {
          where: { status: 'pending' },
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true }
            },
            offeredPokemon: {
              include: { species: true }
            }
          }
        },
        _count: {
          select: { counterOffers: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get single listing with full details
   */
  async getListing(id: string) {
    return prisma.wantListing.findUnique({
      where: { id },
      include: {
        wantedSpecies: true,
        user: {
          select: { id: true, displayName: true, avatarUrl: true }
        },
        offeredPokemon: {
          include: {
            pokemon: {
              include: { species: true }
            }
          }
        },
        counterOffers: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true }
            },
            offeredPokemon: {
              include: { species: true }
            },
            requestedPokemon: {
              include: {
                pokemon: {
                  include: { species: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  /**
   * Cancel a listing (only by owner)
   */
  async cancelListing(userId: string, listingId: string) {
    const listing = await prisma.wantListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.userId !== userId) {
      throw new Error('Not authorized to cancel this listing');
    }

    if (listing.status !== 'open') {
      throw new Error('Listing is not open');
    }

    await prisma.$transaction([
      // Update listing status
      prisma.wantListing.update({
        where: { id: listingId },
        data: { status: 'cancelled' }
      }),
      // Reject all pending counter-offers
      prisma.counterOffer.updateMany({
        where: {
          wantListingId: listingId,
          status: 'pending'
        },
        data: { status: 'rejected' }
      })
    ]);
  }

  /**
   * Update listing offer (only by owner, only if no counter-offers)
   */
  async updateListing(userId: string, listingId: string, data: UpdateListingData) {
    const listing = await prisma.wantListing.findUnique({
      where: { id: listingId },
      include: {
        _count: { select: { counterOffers: true } }
      }
    });

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.userId !== userId) {
      throw new Error('Not authorized to update this listing');
    }

    if (listing.status !== 'open') {
      throw new Error('Listing is not open');
    }

    if (listing._count.counterOffers > 0) {
      throw new Error('Cannot update listing with existing counter-offers');
    }

    // Validate new coins if provided
    if (data.coinsOffered !== undefined && data.coinsOffered > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true }
      });

      if (!user || user.coins < data.coinsOffered) {
        throw new Error('Insufficient coins');
      }
    }

    // Validate new Pokemon if provided
    if (data.offeredPokemonIds !== undefined && data.offeredPokemonIds.length > 0) {
      const ownedPokemon = await prisma.userPokemon.findMany({
        where: {
          id: { in: data.offeredPokemonIds },
          userId
        }
      });

      if (ownedPokemon.length !== data.offeredPokemonIds.length) {
        throw new Error('You do not own all the offered Pokemon');
      }
    }

    // Update listing
    return prisma.$transaction(async (tx) => {
      // Update coins if provided
      if (data.coinsOffered !== undefined) {
        await tx.wantListing.update({
          where: { id: listingId },
          data: { coinsOffered: data.coinsOffered }
        });
      }

      // Update Pokemon if provided
      if (data.offeredPokemonIds !== undefined) {
        // Delete existing offered Pokemon
        await tx.wantListingPokemon.deleteMany({
          where: { wantListingId: listingId }
        });

        // Add new offered Pokemon
        if (data.offeredPokemonIds.length > 0) {
          await tx.wantListingPokemon.createMany({
            data: data.offeredPokemonIds.map(pokemonId => ({
              wantListingId: listingId,
              pokemonId
            }))
          });
        }
      }

      return tx.wantListing.findUnique({
        where: { id: listingId },
        include: {
          wantedSpecies: true,
          offeredPokemon: {
            include: {
              pokemon: {
                include: { species: true }
              }
            }
          }
        }
      });
    });
  }

  /**
   * Accept a listing directly (trade Pokemon for the exact offer)
   */
  async acceptListing(userId: string, listingId: string, pokemonId: string) {
    return prisma.$transaction(async (tx) => {
      // Get listing with all details
      const listing = await tx.wantListing.findUnique({
        where: { id: listingId },
        include: {
          user: true,
          wantedSpecies: true,
          offeredPokemon: {
            include: { pokemon: true }
          }
        }
      });

      if (!listing) {
        throw new Error('Listing not found');
      }

      if (listing.status !== 'open') {
        throw new Error('Listing is not open');
      }

      if (listing.userId === userId) {
        throw new Error('Cannot accept your own listing');
      }

      // Validate user owns the Pokemon
      const pokemon = await tx.userPokemon.findUnique({
        where: { id: pokemonId },
        include: { species: true }
      });

      if (!pokemon) {
        throw new Error('Pokemon not found');
      }

      if (pokemon.userId !== userId) {
        throw new Error('You do not own this Pokemon');
      }

      // Validate Pokemon matches wanted species
      if (pokemon.speciesId !== listing.wantedSpeciesId) {
        throw new Error('Pokemon does not match wanted species');
      }

      // Validate shiny if required
      if (listing.wantShiny && !pokemon.isShiny) {
        throw new Error('Listing requires a shiny Pokemon');
      }

      // Validate listing owner still has offered coins
      if (listing.coinsOffered > 0) {
        if (listing.user.coins < listing.coinsOffered) {
          throw new Error('Listing owner does not have enough coins');
        }
      }

      // Execute trade

      // 1. Transfer the wanted Pokemon to listing owner
      await tx.userPokemon.update({
        where: { id: pokemonId },
        data: {
          userId: listing.userId,
          obtainedMethod: ObtainedMethod.trade,
          obtainedAt: new Date(),
          isInTeam: false,
          teamPosition: null,
          isFavorite: false
        }
      });

      // 2. Transfer offered Pokemon to acceptor
      for (const offeredPokemon of listing.offeredPokemon) {
        await tx.userPokemon.update({
          where: { id: offeredPokemon.pokemonId },
          data: {
            userId,
            obtainedMethod: ObtainedMethod.trade,
            obtainedAt: new Date(),
            isInTeam: false,
            teamPosition: null,
            isFavorite: false
          }
        });
      }

      // 3. Transfer coins
      if (listing.coinsOffered > 0) {
        // Deduct from listing owner
        await tx.user.update({
          where: { id: listing.userId },
          data: { coins: { decrement: listing.coinsOffered } }
        });

        // Add to acceptor
        await tx.user.update({
          where: { id: userId },
          data: { coins: { increment: listing.coinsOffered } }
        });

        // Record transactions
        await tx.coinTransaction.create({
          data: {
            userId: listing.userId,
            amount: -listing.coinsOffered,
            type: CoinTransactionType.want_listing_accepted,
            referenceId: listing.id
          }
        });

        await tx.coinTransaction.create({
          data: {
            userId,
            amount: listing.coinsOffered,
            type: CoinTransactionType.want_listing_accepted,
            referenceId: listing.id
          }
        });
      }

      // 4. Update Pokedex for both users
      await this.updatePokedex(tx, listing.userId, pokemon.speciesId);
      for (const offeredPokemon of listing.offeredPokemon) {
        await this.updatePokedex(tx, userId, offeredPokemon.pokemon.speciesId);
      }

      // 5. Mark listing as completed
      await tx.wantListing.update({
        where: { id: listingId },
        data: { status: 'completed' }
      });

      // 6. Reject all pending counter-offers
      await tx.counterOffer.updateMany({
        where: {
          wantListingId: listingId,
          status: 'pending'
        },
        data: { status: 'rejected' }
      });

      return {
        success: true,
        listing,
        tradedPokemon: pokemon,
        receivedPokemon: listing.offeredPokemon.map(p => p.pokemon),
        coinsReceived: listing.coinsOffered
      };
    });
  }

  /**
   * Helper to update Pokedex entry
   */
  private async updatePokedex(tx: any, userId: string, speciesId: number) {
    await tx.userPokedex.upsert({
      where: {
        userId_speciesId: { userId, speciesId }
      },
      create: {
        userId,
        speciesId,
        timesObtained: 1
      },
      update: {
        timesObtained: { increment: 1 },
        hasCurrently: true
      }
    });
  }

  /**
   * Search for Pokemon matching a listing's wants (for users who might accept)
   */
  async findMatchingPokemon(listingId: string, userId: string) {
    const listing = await prisma.wantListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      throw new Error('Listing not found');
    }

    return prisma.userPokemon.findMany({
      where: {
        userId,
        speciesId: listing.wantedSpeciesId,
        isShiny: listing.wantShiny ? true : undefined
      },
      include: {
        species: true
      }
    });
  }
}

export const wantListingService = new WantListingService();
