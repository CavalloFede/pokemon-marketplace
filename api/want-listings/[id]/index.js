import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id: listingId } = req.query;

  try {
    const auth = await requireAuth(req);

    // GET /api/want-listings/:id
    if (req.method === 'GET') {
      const listing = await prisma.wantListing.findUnique({
        where: { id: listingId },
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

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      return res.status(200).json(listing);
    }

    // PATCH /api/want-listings/:id - Update listing
    if (req.method === 'PATCH') {
      const { coinsOffered, offeredPokemonIds } = req.body || {};

      const listing = await prisma.wantListing.findUnique({
        where: { id: listingId },
        include: {
          _count: { select: { counterOffers: true } }
        }
      });

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      if (listing.userId !== auth.userId) {
        return res.status(403).json({ error: 'Not authorized to update this listing' });
      }

      if (listing.status !== 'open') {
        return res.status(400).json({ error: 'Listing is not open' });
      }

      if (listing._count.counterOffers > 0) {
        return res.status(400).json({ error: 'Cannot update listing with existing counter-offers' });
      }

      // Validate new coins if provided
      if (coinsOffered !== undefined && coinsOffered > 0) {
        const user = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { coins: true }
        });

        if (!user || user.coins < coinsOffered) {
          return res.status(400).json({ error: 'Insufficient coins' });
        }
      }

      // Validate new Pokemon if provided
      if (offeredPokemonIds !== undefined && offeredPokemonIds.length > 0) {
        const ownedPokemon = await prisma.userPokemon.findMany({
          where: {
            id: { in: offeredPokemonIds },
            userId: auth.userId
          }
        });

        if (ownedPokemon.length !== offeredPokemonIds.length) {
          return res.status(400).json({ error: 'You do not own all the offered Pokemon' });
        }
      }

      // Update listing
      const result = await prisma.$transaction(async (tx) => {
        if (coinsOffered !== undefined) {
          await tx.wantListing.update({
            where: { id: listingId },
            data: { coinsOffered }
          });
        }

        if (offeredPokemonIds !== undefined) {
          await tx.wantListingPokemon.deleteMany({
            where: { wantListingId: listingId }
          });

          if (offeredPokemonIds.length > 0) {
            await tx.wantListingPokemon.createMany({
              data: offeredPokemonIds.map(pokemonId => ({
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

      return res.status(200).json(result);
    }

    // DELETE /api/want-listings/:id - Cancel listing
    if (req.method === 'DELETE') {
      const listing = await prisma.wantListing.findUnique({
        where: { id: listingId }
      });

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      if (listing.userId !== auth.userId) {
        return res.status(403).json({ error: 'Not authorized to cancel this listing' });
      }

      if (listing.status !== 'open') {
        return res.status(400).json({ error: 'Listing is not open' });
      }

      await prisma.$transaction([
        prisma.wantListing.update({
          where: { id: listingId },
          data: { status: 'cancelled' }
        }),
        prisma.counterOffer.updateMany({
          where: {
            wantListingId: listingId,
            status: 'pending'
          },
          data: { status: 'rejected' }
        })
      ]);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Want-listing by ID error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
