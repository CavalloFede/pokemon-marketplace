import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

function parseQueryParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(value) {
  const str = parseQueryParam(value);
  if (!str) return undefined;
  const num = parseInt(str, 10);
  return isNaN(num) ? undefined : num;
}

async function updatePokedex(tx, userId, speciesId) {
  await tx.userPokedex.upsert({
    where: { userId_speciesId: { userId, speciesId } },
    create: { userId, speciesId, timesObtained: 1, hasCurrently: true },
    update: { timesObtained: { increment: 1 }, hasCurrently: true }
  });
}

async function handleListListings(req, res, auth) {
  const speciesId = parseIntParam(req.query.speciesId);
  const minCoins = parseIntParam(req.query.minCoins);
  const maxCoins = parseIntParam(req.query.maxCoins);
  const page = parseIntParam(req.query.page) || 1;
  const pageSize = parseIntParam(req.query.pageSize) || 20;
  const excludeSelf = parseQueryParam(req.query.excludeSelf) === 'true';

  const where = { status: 'open', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
  if (speciesId) where.wantedSpeciesId = speciesId;
  if (minCoins !== undefined) where.coinsOffered = { ...where.coinsOffered, gte: minCoins };
  if (maxCoins !== undefined) where.coinsOffered = { ...where.coinsOffered, lte: maxCoins };
  if (excludeSelf) where.userId = { not: auth.userId };

  const [data, total] = await Promise.all([
    prisma.wantListing.findMany({
      where,
      include: {
        wantedSpecies: true,
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        offeredPokemon: { include: { pokemon: { include: { species: true } } } },
        _count: { select: { counterOffers: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.wantListing.count({ where })
  ]);

  return res.status(200).json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

async function handleCreateListing(req, res, auth) {
  const { wantedSpeciesId, wantShiny = false, coinsOffered = 0, offeredPokemonIds = [], expiresInDays } = req.body || {};

  const species = await prisma.pokemonSpecies.findUnique({ where: { id: wantedSpeciesId } });
  if (!species) return res.status(400).json({ error: 'Invalid species ID' });

  if (offeredPokemonIds.length > 0) {
    const ownedPokemon = await prisma.userPokemon.findMany({ where: { id: { in: offeredPokemonIds }, userId: auth.userId } });
    if (ownedPokemon.length !== offeredPokemonIds.length) return res.status(400).json({ error: 'You do not own all the offered Pokemon' });
    const inActiveListing = await prisma.wantListingPokemon.findFirst({ where: { pokemonId: { in: offeredPokemonIds }, wantListing: { status: 'open' } } });
    if (inActiveListing) return res.status(400).json({ error: 'One or more Pokemon are already in an active listing' });
  }

  if (coinsOffered > 0) {
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { coins: true } });
    if (!user || user.coins < coinsOffered) return res.status(400).json({ error: 'Insufficient coins' });
  }

  if (coinsOffered <= 0 && offeredPokemonIds.length === 0) return res.status(400).json({ error: 'Must offer coins or Pokemon' });

  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

  const listing = await prisma.wantListing.create({
    data: {
      userId: auth.userId, wantedSpeciesId, wantShiny, coinsOffered, expiresAt,
      offeredPokemon: { create: offeredPokemonIds.map(pokemonId => ({ pokemonId })) }
    },
    include: {
      wantedSpecies: true,
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      offeredPokemon: { include: { pokemon: { include: { species: true } } } }
    }
  });

  return res.status(201).json(listing);
}

async function handleMyListings(req, res, auth) {
  const listings = await prisma.wantListing.findMany({
    where: { userId: auth.userId },
    include: {
      wantedSpecies: true,
      offeredPokemon: { include: { pokemon: { include: { species: true } } } },
      counterOffers: {
        where: { status: 'pending' },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          offeredPokemon: { include: { species: true } }
        }
      },
      _count: { select: { counterOffers: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  return res.status(200).json(listings);
}

async function handleGetListing(req, res, listingId) {
  const listing = await prisma.wantListing.findUnique({
    where: { id: listingId },
    include: {
      wantedSpecies: true,
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      offeredPokemon: { include: { pokemon: { include: { species: true } } } },
      counterOffers: {
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          offeredPokemon: { include: { species: true } },
          requestedPokemon: { include: { pokemon: { include: { species: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  return res.status(200).json(listing);
}

async function handleUpdateListing(req, res, auth, listingId) {
  const { coinsOffered, offeredPokemonIds } = req.body || {};

  const listing = await prisma.wantListing.findUnique({ where: { id: listingId }, include: { _count: { select: { counterOffers: true } } } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.userId !== auth.userId) return res.status(403).json({ error: 'Not authorized to update this listing' });
  if (listing.status !== 'open') return res.status(400).json({ error: 'Listing is not open' });
  if (listing._count.counterOffers > 0) return res.status(400).json({ error: 'Cannot update listing with existing counter-offers' });

  if (coinsOffered !== undefined && coinsOffered > 0) {
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { coins: true } });
    if (!user || user.coins < coinsOffered) return res.status(400).json({ error: 'Insufficient coins' });
  }

  if (offeredPokemonIds !== undefined && offeredPokemonIds.length > 0) {
    const ownedPokemon = await prisma.userPokemon.findMany({ where: { id: { in: offeredPokemonIds }, userId: auth.userId } });
    if (ownedPokemon.length !== offeredPokemonIds.length) return res.status(400).json({ error: 'You do not own all the offered Pokemon' });
  }

  const result = await prisma.$transaction(async (tx) => {
    if (coinsOffered !== undefined) await tx.wantListing.update({ where: { id: listingId }, data: { coinsOffered } });
    if (offeredPokemonIds !== undefined) {
      await tx.wantListingPokemon.deleteMany({ where: { wantListingId: listingId } });
      if (offeredPokemonIds.length > 0) {
        await tx.wantListingPokemon.createMany({ data: offeredPokemonIds.map(pokemonId => ({ wantListingId: listingId, pokemonId })) });
      }
    }
    return tx.wantListing.findUnique({ where: { id: listingId }, include: { wantedSpecies: true, offeredPokemon: { include: { pokemon: { include: { species: true } } } } } });
  });

  return res.status(200).json(result);
}

async function handleDeleteListing(req, res, auth, listingId) {
  const listing = await prisma.wantListing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.userId !== auth.userId) return res.status(403).json({ error: 'Not authorized to cancel this listing' });
  if (listing.status !== 'open') return res.status(400).json({ error: 'Listing is not open' });

  await prisma.$transaction([
    prisma.wantListing.update({ where: { id: listingId }, data: { status: 'cancelled' } }),
    prisma.counterOffer.updateMany({ where: { wantListingId: listingId, status: 'pending' }, data: { status: 'rejected' } })
  ]);

  return res.status(200).json({ success: true });
}

async function handleAcceptListing(req, res, auth, listingId) {
  const { pokemonId } = req.body || {};
  if (!pokemonId) return res.status(400).json({ error: 'pokemonId is required' });

  const result = await prisma.$transaction(async (tx) => {
    const listing = await tx.wantListing.findUnique({
      where: { id: listingId },
      include: { user: true, wantedSpecies: true, offeredPokemon: { include: { pokemon: true } } }
    });
    if (!listing) throw new Error('Listing not found');
    if (listing.status !== 'open') throw new Error('Listing is not open');
    if (listing.userId === auth.userId) throw new Error('Cannot accept your own listing');

    const pokemon = await tx.userPokemon.findUnique({ where: { id: pokemonId }, include: { species: true } });
    if (!pokemon) throw new Error('Pokemon not found');
    if (pokemon.userId !== auth.userId) throw new Error('You do not own this Pokemon');
    if (pokemon.speciesId !== listing.wantedSpeciesId) throw new Error('Pokemon does not match wanted species');
    if (listing.wantShiny && !pokemon.isShiny) throw new Error('Listing requires a shiny Pokemon');
    if (listing.coinsOffered > 0 && listing.user.coins < listing.coinsOffered) throw new Error('Listing owner does not have enough coins');

    await tx.userPokemon.update({ where: { id: pokemonId }, data: { userId: listing.userId, obtainedMethod: 'trade', obtainedAt: new Date(), isInTeam: false, teamPosition: null, isFavorite: false } });
    for (const offeredPokemon of listing.offeredPokemon) {
      await tx.userPokemon.update({ where: { id: offeredPokemon.pokemonId }, data: { userId: auth.userId, obtainedMethod: 'trade', obtainedAt: new Date(), isInTeam: false, teamPosition: null, isFavorite: false } });
    }

    if (listing.coinsOffered > 0) {
      await tx.user.update({ where: { id: listing.userId }, data: { coins: { decrement: listing.coinsOffered } } });
      await tx.user.update({ where: { id: auth.userId }, data: { coins: { increment: listing.coinsOffered } } });
      await tx.coinTransaction.create({ data: { userId: listing.userId, amount: -listing.coinsOffered, type: 'want_listing_accepted', referenceId: listing.id } });
      await tx.coinTransaction.create({ data: { userId: auth.userId, amount: listing.coinsOffered, type: 'want_listing_accepted', referenceId: listing.id } });
    }

    await updatePokedex(tx, listing.userId, pokemon.speciesId);
    for (const offeredPokemon of listing.offeredPokemon) {
      await updatePokedex(tx, auth.userId, offeredPokemon.pokemon.speciesId);
    }

    await tx.wantListing.update({ where: { id: listingId }, data: { status: 'completed' } });
    await tx.counterOffer.updateMany({ where: { wantListingId: listingId, status: 'pending' }, data: { status: 'rejected' } });

    return { success: true, listing, tradedPokemon: pokemon, receivedPokemon: listing.offeredPokemon.map(p => p.pokemon), coinsReceived: listing.coinsOffered };
  });

  return res.status(200).json(result);
}

async function handleMatchingPokemon(req, res, auth, listingId) {
  const listing = await prisma.wantListing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const where = { userId: auth.userId, speciesId: listing.wantedSpeciesId };
  if (listing.wantShiny) where.isShiny = true;

  const matchingPokemon = await prisma.userPokemon.findMany({ where, include: { species: true } });
  return res.status(200).json(matchingPokemon);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const pathParts = req.query.path || [];

  try {
    const auth = await requireAuth(req);

    // Root: GET/POST /api/want-listings
    if (pathParts.length === 0) {
      if (req.method === 'GET') return handleListListings(req, res, auth);
      if (req.method === 'POST') return handleCreateListing(req, res, auth);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // GET /api/want-listings/mine
    if (pathParts[0] === 'mine' && pathParts.length === 1) {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      return handleMyListings(req, res, auth);
    }

    // Routes with listing ID
    if (pathParts.length >= 1) {
      const listingId = pathParts[0];

      // GET/PATCH/DELETE /api/want-listings/:id
      if (pathParts.length === 1) {
        if (req.method === 'GET') return handleGetListing(req, res, listingId);
        if (req.method === 'PATCH') return handleUpdateListing(req, res, auth, listingId);
        if (req.method === 'DELETE') return handleDeleteListing(req, res, auth, listingId);
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // POST /api/want-listings/:id/accept
      if (pathParts[1] === 'accept' && pathParts.length === 2) {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleAcceptListing(req, res, auth, listingId);
      }

      // GET /api/want-listings/:id/matching-pokemon
      if (pathParts[1] === 'matching-pokemon' && pathParts.length === 2) {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        return handleMatchingPokemon(req, res, auth, listingId);
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Want-listings error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
