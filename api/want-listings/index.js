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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    // GET /api/want-listings - List all open listings
    if (req.method === 'GET') {
      const speciesId = parseIntParam(req.query.speciesId);
      const minCoins = parseIntParam(req.query.minCoins);
      const maxCoins = parseIntParam(req.query.maxCoins);
      const page = parseIntParam(req.query.page) || 1;
      const pageSize = parseIntParam(req.query.pageSize) || 20;
      const excludeSelf = parseQueryParam(req.query.excludeSelf) === 'true';

      const where = {
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

      if (excludeSelf) {
        where.userId = { not: auth.userId };
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

      return res.status(200).json({
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      });
    }

    // POST /api/want-listings - Create a new listing
    if (req.method === 'POST') {
      const {
        wantedSpeciesId,
        wantShiny = false,
        coinsOffered = 0,
        offeredPokemonIds = [],
        expiresInDays
      } = req.body || {};

      // Validate species exists
      const species = await prisma.pokemonSpecies.findUnique({
        where: { id: wantedSpeciesId }
      });

      if (!species) {
        return res.status(400).json({ error: 'Invalid species ID' });
      }

      // Validate user owns all offered Pokemon
      if (offeredPokemonIds.length > 0) {
        const ownedPokemon = await prisma.userPokemon.findMany({
          where: {
            id: { in: offeredPokemonIds },
            userId: auth.userId
          }
        });

        if (ownedPokemon.length !== offeredPokemonIds.length) {
          return res.status(400).json({ error: 'You do not own all the offered Pokemon' });
        }

        // Check Pokemon are not in active listings
        const inActiveListing = await prisma.wantListingPokemon.findFirst({
          where: {
            pokemonId: { in: offeredPokemonIds },
            wantListing: { status: 'open' }
          }
        });

        if (inActiveListing) {
          return res.status(400).json({ error: 'One or more Pokemon are already in an active listing' });
        }
      }

      // Validate user has enough coins
      if (coinsOffered > 0) {
        const user = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { coins: true }
        });

        if (!user || user.coins < coinsOffered) {
          return res.status(400).json({ error: 'Insufficient coins' });
        }
      }

      // Must offer something
      if (coinsOffered <= 0 && offeredPokemonIds.length === 0) {
        return res.status(400).json({ error: 'Must offer coins or Pokemon' });
      }

      // Calculate expiration date
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      // Create listing
      const listing = await prisma.wantListing.create({
        data: {
          userId: auth.userId,
          wantedSpeciesId,
          wantShiny,
          coinsOffered,
          expiresAt,
          offeredPokemon: {
            create: offeredPokemonIds.map(pokemonId => ({ pokemonId }))
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

      return res.status(201).json(listing);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Want-listings error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
