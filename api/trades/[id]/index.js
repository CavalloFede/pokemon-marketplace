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

  const { id: tradeId } = req.query;

  try {
    const auth = await requireAuth(req);

    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        initiator: {
          select: { id: true, displayName: true, avatarUrl: true }
        },
        receiver: {
          select: { id: true, displayName: true, avatarUrl: true }
        }
      }
    });

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Only participants can view trade details
    if (trade.initiatorId !== auth.userId && trade.receiverId !== auth.userId) {
      return res.status(403).json({ error: 'Not authorized to view this trade' });
    }

    const [initiatorPokemon, receiverPokemon] = await Promise.all([
      prisma.userPokemon.findMany({
        where: { id: { in: trade.initiatorPokemonIds } },
        include: { species: true }
      }),
      prisma.userPokemon.findMany({
        where: { id: { in: trade.receiverPokemonIds } },
        include: { species: true }
      })
    ]);

    return res.status(200).json({
      ...trade,
      initiatorPokemon,
      receiverPokemon
    });
  } catch (error) {
    console.error('Get trade error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
