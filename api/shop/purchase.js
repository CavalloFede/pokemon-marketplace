import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Inlined constants
const SHINY_RATE = 1 / 4096;

const EGG_WEIGHTS = {
  common: [
    { rarity: 'common', weight: 70 },
    { rarity: 'uncommon', weight: 30 }
  ],
  rare: [
    { rarity: 'rare', weight: 70 },
    { rarity: 'epic', weight: 30 }
  ],
  legendary: [
    { rarity: 'legendary', weight: 90 },
    { rarity: 'mythical', weight: 10 }
  ],
  mystery: [
    { rarity: 'common', weight: 50 },
    { rarity: 'uncommon', weight: 25 },
    { rarity: 'rare', weight: 15 },
    { rarity: 'epic', weight: 7 },
    { rarity: 'legendary', weight: 2.5 },
    { rarity: 'mythical', weight: 0.5 }
  ]
};

// Experience formula: exp = level^2 * 10
function getExpForLevel(level) {
  return level * level * 10;
}

// Weighted random selection
function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item.rarity;
    }
  }

  return items[items.length - 1].rarity;
}

// Determine if pokemon is shiny
function rollShiny() {
  return Math.random() < SHINY_RATE;
}

// Get initial level for a Pokemon based on its evolution stage
async function getInitialLevel(speciesId) {
  const species = await prisma.pokemonSpecies.findUnique({
    where: { id: speciesId },
    select: {
      evolutionLevel: true,
      evolvesFromId: true
    }
  });

  if (!species) {
    return 1;
  }

  // If it's an evolved form, start at the evolution level
  if (species.evolvesFromId && species.evolutionLevel) {
    return species.evolutionLevel;
  }

  // Base form starts at level 1
  return 1;
}

// Hatch an egg - returns a random pokemon based on egg category
async function hatchEgg(category) {
  const weights = EGG_WEIGHTS[category];

  if (!weights) {
    throw new Error(`Invalid egg category: ${category}`);
  }

  // Roll for rarity
  const rarity = weightedRandom(weights);

  // Get all pokemon of that rarity
  const pokemonPool = await prisma.pokemonSpecies.findMany({
    where: { rarity },
    select: { id: true }
  });

  if (pokemonPool.length === 0) {
    throw new Error(`No Pokemon found for rarity: ${rarity}`);
  }

  // Pick random pokemon from pool
  const randomIndex = Math.floor(Math.random() * pokemonPool.length);
  const selectedPokemon = pokemonPool[randomIndex];

  return {
    speciesId: selectedPokemon.id,
    rarity
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);

    const { itemId } = req.body || {};

    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }

    // Get user and item
    const [user, item] = await Promise.all([
      prisma.user.findUnique({ where: { id: auth.userId } }),
      prisma.shopItem.findUnique({
        where: { id: itemId },
        include: { species: true }
      })
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!item || !item.isActive) {
      return res.status(404).json({ error: 'Item not available' });
    }

    if (user.coins < item.price) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Check stock if limited
    if (item.stock !== null && item.stock <= 0) {
      return res.status(400).json({ error: 'Item out of stock' });
    }

    // Determine what pokemon to give
    let speciesId;
    let obtainedMethod;
    let rolledRarity = null;

    if (item.itemType === 'pokemon' && item.speciesId) {
      // Direct purchase
      speciesId = item.speciesId;
      obtainedMethod = 'shop_purchase';
    } else if (item.itemType === 'egg' && item.eggCategory) {
      // Egg hatch - weighted random
      const result = await hatchEgg(item.eggCategory);
      speciesId = result.speciesId;
      rolledRarity = result.rarity;
      obtainedMethod = 'egg_hatch';
    } else {
      return res.status(400).json({ error: 'Invalid item configuration' });
    }

    // Roll for shiny
    const isShiny = rollShiny();

    // Get initial level based on evolution stage
    const initialLevel = await getInitialLevel(speciesId);
    const initialExp = getExpForLevel(initialLevel);

    // Execute transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct coins
      const updatedUser = await tx.user.update({
        where: { id: auth.userId },
        data: { coins: { decrement: item.price } }
      });

      // Create coin transaction record
      await tx.coinTransaction.create({
        data: {
          userId: auth.userId,
          amount: -item.price,
          type: 'purchase',
          referenceId: itemId
        }
      });

      // Decrease stock if limited
      if (item.stock !== null) {
        await tx.shopItem.update({
          where: { id: itemId },
          data: { stock: { decrement: 1 } }
        });
      }

      // Create user pokemon with initial level
      const userPokemon = await tx.userPokemon.create({
        data: {
          userId: auth.userId,
          speciesId,
          isShiny,
          obtainedMethod,
          level: initialLevel,
          experience: initialExp,
          lastExperienceGainAt: new Date()
        },
        include: { species: true }
      });

      // Update or create pokedex entry
      const existingEntry = await tx.userPokedex.findUnique({
        where: {
          userId_speciesId: { userId: auth.userId, speciesId }
        }
      });

      const isNewPokedexEntry = !existingEntry;

      if (existingEntry) {
        await tx.userPokedex.update({
          where: {
            userId_speciesId: { userId: auth.userId, speciesId }
          },
          data: {
            timesObtained: { increment: 1 },
            hasCurrently: true
          }
        });
      } else {
        await tx.userPokedex.create({
          data: {
            userId: auth.userId,
            speciesId,
            hasCurrently: true
          }
        });
      }

      return {
        pokemon: userPokemon,
        newBalance: updatedUser.coins,
        isNewPokedexEntry,
        isShiny,
        rolledRarity
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Shop purchase error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
