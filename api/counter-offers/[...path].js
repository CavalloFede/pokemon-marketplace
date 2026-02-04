import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

async function updatePokedex(tx, userId, speciesId) {
  await tx.userPokedex.upsert({
    where: { userId_speciesId: { userId, speciesId } },
    create: { userId, speciesId, timesObtained: 1, hasCurrently: true },
    update: { timesObtained: { increment: 1 }, hasCurrently: true }
  });
}

async function handleCreateCounterOffer(req, res, auth) {
  const { wantListingId, offeredPokemonId, coinsRequested = 0, requestedPokemonIds = [], message } = req.body || {};

  if (!wantListingId || !offeredPokemonId) return res.status(400).json({ error: 'wantListingId and offeredPokemonId are required' });

  const listing = await prisma.wantListing.findUnique({ where: { id: wantListingId }, include: { offeredPokemon: true } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'open') return res.status(400).json({ error: 'Listing is not open' });
  if (listing.userId === auth.userId) return res.status(400).json({ error: 'Cannot make counter-offer on your own listing' });

  const offeredPokemon = await prisma.userPokemon.findUnique({ where: { id: offeredPokemonId }, include: { species: true } });
  if (!offeredPokemon) return res.status(404).json({ error: 'Offered Pokemon not found' });
  if (offeredPokemon.userId !== auth.userId) return res.status(400).json({ error: 'You do not own this Pokemon' });
  if (offeredPokemon.speciesId !== listing.wantedSpeciesId) return res.status(400).json({ error: 'Pokemon does not match wanted species' });
  if (listing.wantShiny && !offeredPokemon.isShiny) return res.status(400).json({ error: 'Listing requires a shiny Pokemon' });

  const existingOffer = await prisma.counterOffer.findFirst({ where: { wantListingId, userId: auth.userId, status: 'pending' } });
  if (existingOffer) return res.status(400).json({ error: 'You already have a pending counter-offer on this listing' });

  if (requestedPokemonIds.length > 0) {
    const offeredPokemonIdsInListing = listing.offeredPokemon.map(p => p.pokemonId);
    const invalidPokemon = requestedPokemonIds.filter(id => !offeredPokemonIdsInListing.includes(id));
    if (invalidPokemon.length > 0) return res.status(400).json({ error: 'Requested Pokemon are not part of the listing offer' });
  }

  if (coinsRequested <= 0 && requestedPokemonIds.length === 0) return res.status(400).json({ error: 'Must request coins or Pokemon' });

  const counterOffer = await prisma.counterOffer.create({
    data: {
      wantListingId, userId: auth.userId, offeredPokemonId, coinsRequested, message,
      requestedPokemon: { create: requestedPokemonIds.map(pokemonId => ({ pokemonId })) }
    },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      offeredPokemon: { include: { species: true } },
      requestedPokemon: { include: { pokemon: { include: { species: true } } } },
      wantListing: { include: { user: { select: { id: true, displayName: true } } } }
    }
  });

  return res.status(201).json(counterOffer);
}

async function handleMyCounterOffers(req, res, auth) {
  const counterOffers = await prisma.counterOffer.findMany({
    where: { userId: auth.userId },
    include: {
      offeredPokemon: { include: { species: true } },
      requestedPokemon: { include: { pokemon: { include: { species: true } } } },
      wantListing: {
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          wantedSpecies: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  return res.status(200).json(counterOffers);
}

async function handleGetCounterOffer(req, res, counterOfferId) {
  const counterOffer = await prisma.counterOffer.findUnique({
    where: { id: counterOfferId },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      offeredPokemon: { include: { species: true } },
      requestedPokemon: { include: { pokemon: { include: { species: true } } } },
      wantListing: {
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          wantedSpecies: true,
          offeredPokemon: { include: { pokemon: { include: { species: true } } } }
        }
      }
    }
  });
  if (!counterOffer) return res.status(404).json({ error: 'Counter-offer not found' });
  return res.status(200).json(counterOffer);
}

async function handleWithdrawCounterOffer(req, res, auth, counterOfferId) {
  const counterOffer = await prisma.counterOffer.findUnique({ where: { id: counterOfferId } });
  if (!counterOffer) return res.status(404).json({ error: 'Counter-offer not found' });
  if (counterOffer.userId !== auth.userId) return res.status(403).json({ error: 'Only the counter-offer creator can withdraw it' });
  if (counterOffer.status !== 'pending') return res.status(400).json({ error: 'Counter-offer is no longer pending' });

  await prisma.counterOffer.update({ where: { id: counterOfferId }, data: { status: 'withdrawn' } });
  return res.status(200).json({ success: true });
}

async function handleAcceptCounterOffer(req, res, auth, counterOfferId) {
  const result = await prisma.$transaction(async (tx) => {
    const counterOffer = await tx.counterOffer.findUnique({
      where: { id: counterOfferId },
      include: {
        user: true,
        offeredPokemon: { include: { species: true } },
        requestedPokemon: { include: { pokemon: { include: { species: true } } } },
        wantListing: { include: { user: true, offeredPokemon: { include: { pokemon: true } } } }
      }
    });

    if (!counterOffer) throw new Error('Counter-offer not found');
    if (counterOffer.status !== 'pending') throw new Error('Counter-offer is no longer pending');
    if (counterOffer.wantListing.userId !== auth.userId) throw new Error('Only the listing owner can accept counter-offers');
    if (counterOffer.wantListing.status !== 'open') throw new Error('Listing is no longer open');

    const offeredPokemon = await tx.userPokemon.findUnique({ where: { id: counterOffer.offeredPokemonId } });
    if (!offeredPokemon || offeredPokemon.userId !== counterOffer.userId) throw new Error('Counter-offerer no longer owns the Pokemon');

    if (counterOffer.coinsRequested > 0 && counterOffer.wantListing.user.coins < counterOffer.coinsRequested) {
      throw new Error('Insufficient coins to accept this counter-offer');
    }

    await tx.userPokemon.update({ where: { id: counterOffer.offeredPokemonId }, data: { userId: counterOffer.wantListing.userId, obtainedMethod: 'trade', obtainedAt: new Date(), isInTeam: false, teamPosition: null, isFavorite: false } });

    for (const requested of counterOffer.requestedPokemon) {
      await tx.userPokemon.update({ where: { id: requested.pokemonId }, data: { userId: counterOffer.userId, obtainedMethod: 'trade', obtainedAt: new Date(), isInTeam: false, teamPosition: null, isFavorite: false } });
    }

    if (counterOffer.coinsRequested > 0) {
      await tx.user.update({ where: { id: counterOffer.wantListing.userId }, data: { coins: { decrement: counterOffer.coinsRequested } } });
      await tx.user.update({ where: { id: counterOffer.userId }, data: { coins: { increment: counterOffer.coinsRequested } } });
      await tx.coinTransaction.create({ data: { userId: counterOffer.wantListing.userId, amount: -counterOffer.coinsRequested, type: 'want_listing_accepted', referenceId: counterOffer.id } });
      await tx.coinTransaction.create({ data: { userId: counterOffer.userId, amount: counterOffer.coinsRequested, type: 'want_listing_accepted', referenceId: counterOffer.id } });
    }

    await updatePokedex(tx, counterOffer.wantListing.userId, counterOffer.offeredPokemon.speciesId);
    for (const requested of counterOffer.requestedPokemon) {
      await updatePokedex(tx, counterOffer.userId, requested.pokemon.speciesId);
    }

    await tx.counterOffer.update({ where: { id: counterOfferId }, data: { status: 'accepted' } });
    await tx.wantListing.update({ where: { id: counterOffer.wantListingId }, data: { status: 'completed' } });
    await tx.counterOffer.updateMany({ where: { wantListingId: counterOffer.wantListingId, id: { not: counterOfferId }, status: 'pending' }, data: { status: 'rejected' } });

    return { success: true, counterOffer, tradedPokemon: counterOffer.offeredPokemon, receivedPokemon: counterOffer.requestedPokemon.map(p => p.pokemon), coinsReceived: counterOffer.coinsRequested };
  });

  return res.status(200).json(result);
}

async function handleRejectCounterOffer(req, res, auth, counterOfferId) {
  const counterOffer = await prisma.counterOffer.findUnique({ where: { id: counterOfferId }, include: { wantListing: true } });
  if (!counterOffer) return res.status(404).json({ error: 'Counter-offer not found' });
  if (counterOffer.wantListing.userId !== auth.userId) return res.status(403).json({ error: 'Only the listing owner can reject counter-offers' });
  if (counterOffer.status !== 'pending') return res.status(400).json({ error: 'Counter-offer is no longer pending' });

  await prisma.counterOffer.update({ where: { id: counterOfferId }, data: { status: 'rejected' } });
  return res.status(200).json({ success: true });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const qp = req.query['...path'];
  const rawPath = Array.isArray(qp) ? qp : qp ? [qp] : [];
  const pathParts = rawPath[0] === '__root' ? [] : rawPath;

  try {
    const auth = await requireAuth(req);

    // POST /api/counter-offers (root)
    if (pathParts.length === 0) {
      if (req.method === 'POST') return handleCreateCounterOffer(req, res, auth);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // GET /api/counter-offers/mine
    if (pathParts[0] === 'mine' && pathParts.length === 1) {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      return handleMyCounterOffers(req, res, auth);
    }

    // Routes with counter-offer ID
    if (pathParts.length === 1 && pathParts[0] !== 'mine') {
      const counterOfferId = pathParts[0];
      const action = req.query.action;

      if (action === 'accept') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleAcceptCounterOffer(req, res, auth, counterOfferId);
      }

      if (action === 'reject') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleRejectCounterOffer(req, res, auth, counterOfferId);
      }

      // GET/DELETE /api/counter-offers/:id (no action)
      if (!action) {
        if (req.method === 'GET') return handleGetCounterOffer(req, res, counterOfferId);
        if (req.method === 'DELETE') return handleWithdrawCounterOffer(req, res, auth, counterOfferId);
        return res.status(405).json({ error: 'Method not allowed' });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Counter-offers error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
