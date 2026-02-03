import { prisma } from '../lib/prisma.js';
import { ObtainedMethod, CoinTransactionType } from '@prisma/client';

interface CreateCounterOfferData {
  wantListingId: string;
  offeredPokemonId: string;
  coinsRequested: number;
  requestedPokemonIds: string[];
  message?: string;
}

export class CounterOfferService {
  /**
   * Create a counter-offer on a listing
   */
  async createCounterOffer(userId: string, data: CreateCounterOfferData) {
    // Get the listing
    const listing = await prisma.wantListing.findUnique({
      where: { id: data.wantListingId },
      include: {
        offeredPokemon: true
      }
    });

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.status !== 'open') {
      throw new Error('Listing is not open');
    }

    if (listing.userId === userId) {
      throw new Error('Cannot make counter-offer on your own listing');
    }

    // Validate user owns the offered Pokemon
    const offeredPokemon = await prisma.userPokemon.findUnique({
      where: { id: data.offeredPokemonId },
      include: { species: true }
    });

    if (!offeredPokemon) {
      throw new Error('Offered Pokemon not found');
    }

    if (offeredPokemon.userId !== userId) {
      throw new Error('You do not own this Pokemon');
    }

    // Validate Pokemon matches wanted species
    if (offeredPokemon.speciesId !== listing.wantedSpeciesId) {
      throw new Error('Pokemon does not match wanted species');
    }

    // Validate shiny if required
    if (listing.wantShiny && !offeredPokemon.isShiny) {
      throw new Error('Listing requires a shiny Pokemon');
    }

    // Check if user already has pending counter-offer on this listing
    const existingOffer = await prisma.counterOffer.findFirst({
      where: {
        wantListingId: data.wantListingId,
        userId,
        status: 'pending'
      }
    });

    if (existingOffer) {
      throw new Error('You already have a pending counter-offer on this listing');
    }

    // Validate requested Pokemon are from listing's offered Pokemon
    if (data.requestedPokemonIds.length > 0) {
      const offeredPokemonIds = listing.offeredPokemon.map(p => p.pokemonId);
      const invalidPokemon = data.requestedPokemonIds.filter(
        id => !offeredPokemonIds.includes(id)
      );

      if (invalidPokemon.length > 0) {
        throw new Error('Requested Pokemon are not part of the listing offer');
      }
    }

    // Must request something (coins or Pokemon)
    if (data.coinsRequested <= 0 && data.requestedPokemonIds.length === 0) {
      throw new Error('Must request coins or Pokemon');
    }

    // Create counter-offer
    const counterOffer = await prisma.counterOffer.create({
      data: {
        wantListingId: data.wantListingId,
        userId,
        offeredPokemonId: data.offeredPokemonId,
        coinsRequested: data.coinsRequested,
        message: data.message,
        requestedPokemon: {
          create: data.requestedPokemonIds.map(pokemonId => ({ pokemonId }))
        }
      },
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
        },
        wantListing: {
          include: {
            user: {
              select: { id: true, displayName: true }
            }
          }
        }
      }
    });

    return counterOffer;
  }

  /**
   * Accept a counter-offer (listing owner only)
   */
  async acceptCounterOffer(userId: string, counterOfferId: string) {
    return prisma.$transaction(async (tx) => {
      // Get counter-offer with all details
      const counterOffer = await tx.counterOffer.findUnique({
        where: { id: counterOfferId },
        include: {
          user: true,
          offeredPokemon: {
            include: { species: true }
          },
          requestedPokemon: {
            include: {
              pokemon: {
                include: { species: true }
              }
            }
          },
          wantListing: {
            include: {
              user: true,
              offeredPokemon: {
                include: { pokemon: true }
              }
            }
          }
        }
      });

      if (!counterOffer) {
        throw new Error('Counter-offer not found');
      }

      if (counterOffer.status !== 'pending') {
        throw new Error('Counter-offer is no longer pending');
      }

      if (counterOffer.wantListing.userId !== userId) {
        throw new Error('Only the listing owner can accept counter-offers');
      }

      if (counterOffer.wantListing.status !== 'open') {
        throw new Error('Listing is no longer open');
      }

      // Validate counter-offerer still owns the Pokemon
      const offeredPokemon = await tx.userPokemon.findUnique({
        where: { id: counterOffer.offeredPokemonId }
      });

      if (!offeredPokemon || offeredPokemon.userId !== counterOffer.userId) {
        throw new Error('Counter-offerer no longer owns the Pokemon');
      }

      // Validate listing owner has enough coins if requested
      if (counterOffer.coinsRequested > 0) {
        if (counterOffer.wantListing.user.coins < counterOffer.coinsRequested) {
          throw new Error('Insufficient coins to accept this counter-offer');
        }
      }

      // Execute trade

      // 1. Transfer the offered Pokemon to listing owner (the wanted Pokemon)
      await tx.userPokemon.update({
        where: { id: counterOffer.offeredPokemonId },
        data: {
          userId: counterOffer.wantListing.userId,
          obtainedMethod: ObtainedMethod.trade,
          obtainedAt: new Date(),
          isInTeam: false,
          teamPosition: null,
          isFavorite: false
        }
      });

      // 2. Transfer requested Pokemon to counter-offerer
      for (const requested of counterOffer.requestedPokemon) {
        await tx.userPokemon.update({
          where: { id: requested.pokemonId },
          data: {
            userId: counterOffer.userId,
            obtainedMethod: ObtainedMethod.trade,
            obtainedAt: new Date(),
            isInTeam: false,
            teamPosition: null,
            isFavorite: false
          }
        });
      }

      // 3. Transfer coins if requested
      if (counterOffer.coinsRequested > 0) {
        // Deduct from listing owner
        await tx.user.update({
          where: { id: counterOffer.wantListing.userId },
          data: { coins: { decrement: counterOffer.coinsRequested } }
        });

        // Add to counter-offerer
        await tx.user.update({
          where: { id: counterOffer.userId },
          data: { coins: { increment: counterOffer.coinsRequested } }
        });

        // Record transactions
        await tx.coinTransaction.create({
          data: {
            userId: counterOffer.wantListing.userId,
            amount: -counterOffer.coinsRequested,
            type: CoinTransactionType.want_listing_accepted,
            referenceId: counterOffer.id
          }
        });

        await tx.coinTransaction.create({
          data: {
            userId: counterOffer.userId,
            amount: counterOffer.coinsRequested,
            type: CoinTransactionType.want_listing_accepted,
            referenceId: counterOffer.id
          }
        });
      }

      // 4. Update Pokedex entries
      await this.updatePokedex(tx, counterOffer.wantListing.userId, counterOffer.offeredPokemon.speciesId);
      for (const requested of counterOffer.requestedPokemon) {
        await this.updatePokedex(tx, counterOffer.userId, requested.pokemon.speciesId);
      }

      // 5. Mark counter-offer as accepted
      await tx.counterOffer.update({
        where: { id: counterOfferId },
        data: { status: 'accepted' }
      });

      // 6. Mark listing as completed
      await tx.wantListing.update({
        where: { id: counterOffer.wantListingId },
        data: { status: 'completed' }
      });

      // 7. Reject all other pending counter-offers
      await tx.counterOffer.updateMany({
        where: {
          wantListingId: counterOffer.wantListingId,
          id: { not: counterOfferId },
          status: 'pending'
        },
        data: { status: 'rejected' }
      });

      return {
        success: true,
        counterOffer,
        tradedPokemon: counterOffer.offeredPokemon,
        receivedPokemon: counterOffer.requestedPokemon.map(p => p.pokemon),
        coinsReceived: counterOffer.coinsRequested
      };
    });
  }

  /**
   * Reject a counter-offer (listing owner only)
   */
  async rejectCounterOffer(userId: string, counterOfferId: string) {
    const counterOffer = await prisma.counterOffer.findUnique({
      where: { id: counterOfferId },
      include: {
        wantListing: true
      }
    });

    if (!counterOffer) {
      throw new Error('Counter-offer not found');
    }

    if (counterOffer.wantListing.userId !== userId) {
      throw new Error('Only the listing owner can reject counter-offers');
    }

    if (counterOffer.status !== 'pending') {
      throw new Error('Counter-offer is no longer pending');
    }

    await prisma.counterOffer.update({
      where: { id: counterOfferId },
      data: { status: 'rejected' }
    });
  }

  /**
   * Withdraw a counter-offer (counter-offerer only)
   */
  async withdrawCounterOffer(userId: string, counterOfferId: string) {
    const counterOffer = await prisma.counterOffer.findUnique({
      where: { id: counterOfferId }
    });

    if (!counterOffer) {
      throw new Error('Counter-offer not found');
    }

    if (counterOffer.userId !== userId) {
      throw new Error('Only the counter-offer creator can withdraw it');
    }

    if (counterOffer.status !== 'pending') {
      throw new Error('Counter-offer is no longer pending');
    }

    await prisma.counterOffer.update({
      where: { id: counterOfferId },
      data: { status: 'withdrawn' }
    });
  }

  /**
   * Get counter-offers for a listing
   */
  async getCounterOffers(listingId: string) {
    return prisma.counterOffer.findMany({
      where: { wantListingId: listingId },
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
    });
  }

  /**
   * Get user's counter-offers
   */
  async getUserCounterOffers(userId: string) {
    return prisma.counterOffer.findMany({
      where: { userId },
      include: {
        offeredPokemon: {
          include: { species: true }
        },
        requestedPokemon: {
          include: {
            pokemon: {
              include: { species: true }
            }
          }
        },
        wantListing: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true }
            },
            wantedSpecies: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get a single counter-offer by ID
   */
  async getCounterOffer(counterOfferId: string) {
    return prisma.counterOffer.findUnique({
      where: { id: counterOfferId },
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
        },
        wantListing: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true }
            },
            wantedSpecies: true,
            offeredPokemon: {
              include: {
                pokemon: {
                  include: { species: true }
                }
              }
            }
          }
        }
      }
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
}

export const counterOfferService = new CounterOfferService();
