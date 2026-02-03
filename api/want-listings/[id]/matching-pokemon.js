import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id: listingId } = req.query;

  try {
    const auth = await requireAuth(req);

    const listing = await prisma.wantListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const where = {
      userId: auth.userId,
      speciesId: listing.wantedSpeciesId
    };

    // If listing wants shiny, only return shiny Pokemon
    if (listing.wantShiny) {
      where.isShiny = true;
    }

    const matchingPokemon = await prisma.userPokemon.findMany({
      where,
      include: {
        species: true
      }
    });

    return res.status(200).json(matchingPokemon);
  } catch (error) {
    console.error('Find matching Pokemon error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
