import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);

    const {
      wantListingId,
      offeredPokemonId,
      coinsRequested = 0,
      requestedPokemonIds = [],
      message
    } = req.body || {};

    if (!wantListingId || !offeredPokemonId) {
      return res.status(400).json({ error: 'wantListingId and offeredPokemonId are required' });
    }

    // Get the listing
    const listing = await prisma.wantListing.findUnique({
      where: { id: wantListingId },
      include: {
        offeredPokemon: true
      }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'open') {
      return res.status(400).json({ error: 'Listing is not open' });
    }

    if (listing.userId === auth.userId) {
      return res.status(400).json({ error: 'Cannot make counter-offer on your own listing' });
    }

    // Validate user owns the offered Pokemon
    const offeredPokemon = await prisma.userPokemon.findUnique({
      where: { id: offeredPokemonId },
      include: { species: true }
    });

    if (!offeredPokemon) {
      return res.status(404).json({ error: 'Offered Pokemon not found' });
    }

    if (offeredPokemon.userId !== auth.userId) {
      return res.status(400).json({ error: 'You do not own this Pokemon' });
    }

    // Validate Pokemon matches wanted species
    if (offeredPokemon.speciesId !== listing.wantedSpeciesId) {
      return res.status(400).json({ error: 'Pokemon does not match wanted species' });
    }

    // Validate shiny if required
    if (listing.wantShiny && !offeredPokemon.isShiny) {
      return res.status(400).json({ error: 'Listing requires a shiny Pokemon' });
    }

    // Check if user already has pending counter-offer on this listing
    const existingOffer = await prisma.counterOffer.findFirst({
      where: {
        wantListingId,
        userId: auth.userId,
        status: 'pending'
      }
    });

    if (existingOffer) {
      return res.status(400).json({ error: 'You already have a pending counter-offer on this listing' });
    }

    // Validate requested Pokemon are from listing's offered Pokemon
    if (requestedPokemonIds.length > 0) {
      const offeredPokemonIdsInListing = listing.offeredPokemon.map(p => p.pokemonId);
      const invalidPokemon = requestedPokemonIds.filter(
        id => !offeredPokemonIdsInListing.includes(id)
      );

      if (invalidPokemon.length > 0) {
        return res.status(400).json({ error: 'Requested Pokemon are not part of the listing offer' });
      }
    }

    // Must request something (coins or Pokemon)
    if (coinsRequested <= 0 && requestedPokemonIds.length === 0) {
      return res.status(400).json({ error: 'Must request coins or Pokemon' });
    }

    // Create counter-offer
    const counterOffer = await prisma.counterOffer.create({
      data: {
        wantListingId,
        userId: auth.userId,
        offeredPokemonId,
        coinsRequested,
        message,
        requestedPokemon: {
          create: requestedPokemonIds.map(pokemonId => ({ pokemonId }))
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

    return res.status(201).json(counterOffer);
  } catch (error) {
    console.error('Create counter-offer error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
