import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);

    const counterOffers = await prisma.counterOffer.findMany({
      where: { userId: auth.userId },
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

    return res.status(200).json(counterOffers);
  } catch (error) {
    console.error('Get my counter-offers error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
