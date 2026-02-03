import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Rarity prices and sell multiplier
const RARITY_PRICES = {
  common: 100, uncommon: 250, rare: 500, epic: 1000, legendary: 5000, mythical: 10000
};
const SELL_PRICE_MULTIPLIER = 0.5;

function getSellPrice(rarity) {
  return Math.floor((RARITY_PRICES[rarity] || 100) * SELL_PRICE_MULTIPLIER);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id: pokemonId } = req.query;

  try {
    const auth = await requireAuth(req);

    const pokemon = await prisma.userPokemon.findFirst({
      where: { id: pokemonId, userId: auth.userId },
      include: { species: true }
    });

    if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });

    // GET - Preview sell price
    if (req.method === 'GET') {
      const sellPrice = getSellPrice(pokemon.species.rarity);
      if (pokemon.isFavorite) {
        return res.status(200).json({ canSell: false, sellPrice, reason: 'Pokemon is favorited' });
      }
      if (pokemon.isInTeam) {
        return res.status(200).json({ canSell: false, sellPrice, reason: 'Pokemon is in team' });
      }
      return res.status(200).json({ canSell: true, sellPrice });
    }

    // POST - Sell pokemon
    if (req.method === 'POST') {
      if (pokemon.isFavorite) {
        return res.status(400).json({ error: 'Cannot sell a favorite Pokemon. Remove from favorites first.' });
      }
      if (pokemon.isInTeam) {
        return res.status(400).json({ error: 'Cannot sell a Pokemon in your team. Remove from team first.' });
      }

      const sellPrice = getSellPrice(pokemon.species.rarity);

      const result = await prisma.$transaction(async (tx) => {
        await tx.userPokemon.delete({ where: { id: pokemonId } });

        const updatedUser = await tx.user.update({
          where: { id: auth.userId },
          data: { coins: { increment: sellPrice } }
        });

        await tx.coinTransaction.create({
          data: {
            userId: auth.userId,
            amount: sellPrice,
            type: 'sale',
            referenceId: pokemonId
          }
        });

        const remainingCount = await tx.userPokemon.count({
          where: { userId: auth.userId, speciesId: pokemon.speciesId }
        });

        if (remainingCount === 0) {
          await tx.userPokedex.updateMany({
            where: { userId: auth.userId, speciesId: pokemon.speciesId },
            data: { hasCurrently: false }
          });
        }

        return updatedUser;
      });

      return res.status(200).json({
        success: true,
        coinsReceived: sellPrice,
        newBalance: result.coins,
        soldPokemon: { speciesId: pokemon.speciesId, speciesName: pokemon.species.name }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sell pokemon error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
