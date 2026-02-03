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

  const { id: listingId } = req.query;

  try {
    const auth = await requireAuth(req);

    const { pokemonId } = req.body || {};

    if (!pokemonId) {
      return res.status(400).json({ error: 'pokemonId is required' });
    }

    const result = await prisma.$transaction(async (tx) => {
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

      if (listing.userId === auth.userId) {
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

      if (pokemon.userId !== auth.userId) {
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
          obtainedMethod: 'trade',
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
            userId: auth.userId,
            obtainedMethod: 'trade',
            obtainedAt: new Date(),
            isInTeam: false,
            teamPosition: null,
            isFavorite: false
          }
        });
      }

      // 3. Transfer coins
      if (listing.coinsOffered > 0) {
        await tx.user.update({
          where: { id: listing.userId },
          data: { coins: { decrement: listing.coinsOffered } }
        });

        await tx.user.update({
          where: { id: auth.userId },
          data: { coins: { increment: listing.coinsOffered } }
        });

        await tx.coinTransaction.create({
          data: {
            userId: listing.userId,
            amount: -listing.coinsOffered,
            type: 'want_listing_accepted',
            referenceId: listing.id
          }
        });

        await tx.coinTransaction.create({
          data: {
            userId: auth.userId,
            amount: listing.coinsOffered,
            type: 'want_listing_accepted',
            referenceId: listing.id
          }
        });
      }

      // 4. Update Pokedex for both users
      await updatePokedex(tx, listing.userId, pokemon.speciesId);
      for (const offeredPokemon of listing.offeredPokemon) {
        await updatePokedex(tx, auth.userId, offeredPokemon.pokemon.speciesId);
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

    return res.status(200).json(result);
  } catch (error) {
    console.error('Accept want-listing error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
