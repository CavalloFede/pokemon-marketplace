import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id: counterOfferId } = req.query;

  try {
    const auth = await requireAuth(req);

    // GET /api/counter-offers/:id
    if (req.method === 'GET') {
      const counterOffer = await prisma.counterOffer.findUnique({
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

      if (!counterOffer) {
        return res.status(404).json({ error: 'Counter-offer not found' });
      }

      return res.status(200).json(counterOffer);
    }

    // DELETE /api/counter-offers/:id - Withdraw counter-offer
    if (req.method === 'DELETE') {
      const counterOffer = await prisma.counterOffer.findUnique({
        where: { id: counterOfferId }
      });

      if (!counterOffer) {
        return res.status(404).json({ error: 'Counter-offer not found' });
      }

      if (counterOffer.userId !== auth.userId) {
        return res.status(403).json({ error: 'Only the counter-offer creator can withdraw it' });
      }

      if (counterOffer.status !== 'pending') {
        return res.status(400).json({ error: 'Counter-offer is no longer pending' });
      }

      await prisma.counterOffer.update({
        where: { id: counterOfferId },
        data: { status: 'withdrawn' }
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Counter-offer by ID error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
