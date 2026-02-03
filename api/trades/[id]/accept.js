import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Helper to get full trade details
async function getTradeWithDetails(tradeId) {
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

  if (!trade) return null;

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

  return {
    ...trade,
    initiatorPokemon,
    receiverPokemon
  };
}

// Update hasCurrently for pokedex entries
async function updateHasCurrently(userId, speciesId) {
  const count = await prisma.userPokemon.count({
    where: { userId, speciesId }
  });

  await prisma.userPokedex.updateMany({
    where: { userId, speciesId },
    data: { hasCurrently: count > 0 }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id: tradeId } = req.query;

  try {
    const auth = await requireAuth(req);

    const trade = await prisma.trade.findUnique({
      where: { id: tradeId }
    });

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.receiverId !== auth.userId) {
      return res.status(403).json({ error: 'Only the receiver can accept this trade' });
    }

    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Trade is not pending' });
    }

    if (new Date() > trade.expiresAt) {
      await prisma.trade.update({
        where: { id: tradeId },
        data: { status: 'expired' }
      });
      return res.status(400).json({ error: 'Trade has expired' });
    }

    // Execute trade atomically
    await prisma.$transaction(async (tx) => {
      // Transfer initiator's pokemon to receiver
      await tx.userPokemon.updateMany({
        where: { id: { in: trade.initiatorPokemonIds } },
        data: {
          userId: trade.receiverId,
          isInTeam: false,
          teamPosition: null
        }
      });

      // Transfer receiver's pokemon to initiator
      await tx.userPokemon.updateMany({
        where: { id: { in: trade.receiverPokemonIds } },
        data: {
          userId: trade.initiatorId,
          isInTeam: false,
          teamPosition: null
        }
      });

      // Transfer coins if any
      if (trade.coinsOffered > 0) {
        // Check sender balance
        const sender = await tx.user.findUnique({
          where: { id: trade.initiatorId },
          select: { coins: true }
        });

        if (!sender || sender.coins < trade.coinsOffered) {
          throw new Error('Insufficient coins');
        }

        // Deduct from sender
        await tx.user.update({
          where: { id: trade.initiatorId },
          data: { coins: { decrement: trade.coinsOffered } }
        });

        await tx.coinTransaction.create({
          data: {
            userId: trade.initiatorId,
            amount: -trade.coinsOffered,
            type: 'trade_sent',
            referenceId: tradeId
          }
        });

        // Add to receiver
        await tx.user.update({
          where: { id: trade.receiverId },
          data: { coins: { increment: trade.coinsOffered } }
        });

        await tx.coinTransaction.create({
          data: {
            userId: trade.receiverId,
            amount: trade.coinsOffered,
            type: 'trade_received',
            referenceId: tradeId
          }
        });
      }

      // Get species IDs for pokedex updates
      const initiatorPokemonData = await tx.userPokemon.findMany({
        where: { id: { in: trade.initiatorPokemonIds } },
        select: { speciesId: true }
      });
      const receiverPokemonData = await tx.userPokemon.findMany({
        where: { id: { in: trade.receiverPokemonIds } },
        select: { speciesId: true }
      });

      const initiatorSpeciesIds = [...new Set(initiatorPokemonData.map(p => p.speciesId))];
      const receiverSpeciesIds = [...new Set(receiverPokemonData.map(p => p.speciesId))];

      // Update pokedex for receiver (receives initiator's pokemon)
      for (const speciesId of initiatorSpeciesIds) {
        await tx.userPokedex.upsert({
          where: {
            userId_speciesId: { userId: trade.receiverId, speciesId }
          },
          update: {
            timesObtained: { increment: 1 },
            hasCurrently: true
          },
          create: {
            userId: trade.receiverId,
            speciesId,
            hasCurrently: true
          }
        });
      }

      // Update pokedex for initiator (receives receiver's pokemon)
      for (const speciesId of receiverSpeciesIds) {
        await tx.userPokedex.upsert({
          where: {
            userId_speciesId: { userId: trade.initiatorId, speciesId }
          },
          update: {
            timesObtained: { increment: 1 },
            hasCurrently: true
          },
          create: {
            userId: trade.initiatorId,
            speciesId,
            hasCurrently: true
          }
        });
      }

      // Update trade status
      await tx.trade.update({
        where: { id: tradeId },
        data: {
          status: 'accepted',
          completedAt: new Date()
        }
      });
    });

    // After transaction: update hasCurrently for species given away
    const initiatorPokemon = await prisma.userPokemon.findMany({
      where: { id: { in: trade.initiatorPokemonIds } },
      select: { speciesId: true }
    });
    const receiverPokemon = await prisma.userPokemon.findMany({
      where: { id: { in: trade.receiverPokemonIds } },
      select: { speciesId: true }
    });

    const initiatorGaveSpecies = [...new Set(initiatorPokemon.map(p => p.speciesId))];
    const receiverGaveSpecies = [...new Set(receiverPokemon.map(p => p.speciesId))];

    // Update hasCurrently for initiator (gave away initiator's pokemon)
    for (const speciesId of initiatorGaveSpecies) {
      await updateHasCurrently(trade.initiatorId, speciesId);
    }

    // Update hasCurrently for receiver (gave away receiver's pokemon)
    for (const speciesId of receiverGaveSpecies) {
      await updateHasCurrently(trade.receiverId, speciesId);
    }

    const result = await getTradeWithDetails(tradeId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Accept trade error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
