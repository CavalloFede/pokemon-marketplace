import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Helper to update Pokedex entry
async function updatePokedex(tx, userId, speciesId) {
  await tx.userPokedex.upsert({
    where: {
      userId_speciesId: { userId, speciesId }
    },
    create: {
      userId,
      speciesId,
      timesObtained: 1,
      hasCurrently: true
    },
    update: {
      timesObtained: { increment: 1 },
      hasCurrently: true
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id: counterOfferId } = req.query;

  try {
    const auth = await requireAuth(req);

    const result = await prisma.$transaction(async (tx) => {
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

      if (counterOffer.wantListing.userId !== auth.userId) {
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
          obtainedMethod: 'trade',
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
            obtainedMethod: 'trade',
            obtainedAt: new Date(),
            isInTeam: false,
            teamPosition: null,
            isFavorite: false
          }
        });
      }

      // 3. Transfer coins if requested
      if (counterOffer.coinsRequested > 0) {
        await tx.user.update({
          where: { id: counterOffer.wantListing.userId },
          data: { coins: { decrement: counterOffer.coinsRequested } }
        });

        await tx.user.update({
          where: { id: counterOffer.userId },
          data: { coins: { increment: counterOffer.coinsRequested } }
        });

        await tx.coinTransaction.create({
          data: {
            userId: counterOffer.wantListing.userId,
            amount: -counterOffer.coinsRequested,
            type: 'want_listing_accepted',
            referenceId: counterOffer.id
          }
        });

        await tx.coinTransaction.create({
          data: {
            userId: counterOffer.userId,
            amount: counterOffer.coinsRequested,
            type: 'want_listing_accepted',
            referenceId: counterOffer.id
          }
        });
      }

      // 4. Update Pokedex entries
      await updatePokedex(tx, counterOffer.wantListing.userId, counterOffer.offeredPokemon.speciesId);
      for (const requested of counterOffer.requestedPokemon) {
        await updatePokedex(tx, counterOffer.userId, requested.pokemon.speciesId);
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

    return res.status(200).json(result);
  } catch (error) {
    console.error('Accept counter-offer error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
