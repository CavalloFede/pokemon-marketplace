import { prisma } from '../lib/prisma.js';
import {
  PokemonRarity,
  EggCategory,
  ObtainedMethod,
  CoinTransactionType,
  EGG_WEIGHTS,
  SHINY_RATE,
  getExpForLevel
} from '@pokemon-marketplace/shared';
import { levelService } from './level.service.js';

interface WeightedItem {
  rarity: PokemonRarity;
  weight: number;
}

/**
 * Weighted random selection
 */
function weightedRandom(items: WeightedItem[]): PokemonRarity {
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

/**
 * Determine if pokemon is shiny (1/4096 chance)
 */
function rollShiny(): boolean {
  return Math.random() < SHINY_RATE;
}

export class ShopService {
  /**
   * Get all active shop items
   */
  async getShopItems() {
    const items = await prisma.shopItem.findMany({
      where: { isActive: true },
      include: {
        species: true
      },
      orderBy: [
        { itemType: 'asc' },
        { price: 'asc' }
      ]
    });

    return items;
  }

  /**
   * Purchase an item from the shop
   */
  async purchaseItem(userId: string, itemId: string) {
    // Get user and item
    const [user, item] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.shopItem.findUnique({
        where: { id: itemId },
        include: { species: true }
      })
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    if (!item || !item.isActive) {
      throw new Error('Item not available');
    }

    if (user.coins < item.price) {
      throw new Error('Insufficient coins');
    }

    // Check stock if limited
    if (item.stock !== null && item.stock <= 0) {
      throw new Error('Item out of stock');
    }

    // Determine what pokemon to give
    let speciesId: number;
    let obtainedMethod: ObtainedMethod;
    let rolledRarity: PokemonRarity | null = null;

    if (item.itemType === 'pokemon' && item.speciesId) {
      // Direct purchase
      speciesId = item.speciesId;
      obtainedMethod = ObtainedMethod.SHOP_PURCHASE;
    } else if (item.itemType === 'egg' && item.eggCategory) {
      // Egg hatch - weighted random
      const result = await this.hatchEgg(item.eggCategory as EggCategory);
      speciesId = result.speciesId;
      rolledRarity = result.rarity;
      obtainedMethod = ObtainedMethod.EGG_HATCH;
    } else {
      throw new Error('Invalid item configuration');
    }

    // Roll for shiny
    const isShiny = rollShiny();

    // Get initial level based on evolution stage
    const initialLevel = await levelService.getInitialLevel(speciesId);
    const initialExp = getExpForLevel(initialLevel);

    // Execute transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct coins
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { coins: { decrement: item.price } }
      });

      // Create coin transaction record
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: -item.price,
          type: CoinTransactionType.PURCHASE,
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
          userId,
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
          userId_speciesId: { userId, speciesId }
        }
      });

      const isNewPokedexEntry = !existingEntry;

      if (existingEntry) {
        await tx.userPokedex.update({
          where: {
            userId_speciesId: { userId, speciesId }
          },
          data: {
            timesObtained: { increment: 1 },
            hasCurrently: true
          }
        });
      } else {
        await tx.userPokedex.create({
          data: {
            userId,
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

    return result;
  }

  /**
   * Hatch an egg - returns a random pokemon based on egg category
   */
  private async hatchEgg(category: EggCategory): Promise<{
    speciesId: number;
    rarity: PokemonRarity;
  }> {
    // Get weights for this egg category
    const weights = EGG_WEIGHTS[category];

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
}

  /**
   * Rotate featured Pokemon in the shop
   * Deactivates current pokemon items and creates 6 new random ones
   */
  async rotateShopItems() {
    // Deactivate all current pokemon items
    await prisma.shopItem.updateMany({
      where: { itemType: 'pokemon', isActive: true },
      data: { isActive: false },
    });

    // Pick 6 random species spread across rarities
    // 2 common/uncommon, 2 rare/epic, 1 legendary, 1 mythical
    const rarityBuckets: { rarities: PokemonRarity[]; count: number }[] = [
      { rarities: [PokemonRarity.COMMON, PokemonRarity.UNCOMMON], count: 2 },
      { rarities: [PokemonRarity.RARE, PokemonRarity.EPIC], count: 2 },
      { rarities: [PokemonRarity.LEGENDARY], count: 1 },
      { rarities: [PokemonRarity.MYTHICAL], count: 1 },
    ];

    const newItems: { speciesId: number; price: number }[] = [];

    for (const bucket of rarityBuckets) {
      const species = await prisma.pokemonSpecies.findMany({
        where: { rarity: { in: bucket.rarities } },
        select: { id: true, basePrice: true },
      });

      // Shuffle and pick
      const shuffled = species.sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, bucket.count);

      for (const s of picked) {
        newItems.push({ speciesId: s.id, price: s.basePrice });
      }
    }

    // Create new shop items
    await prisma.shopItem.createMany({
      data: newItems.map((item) => ({
        itemType: 'pokemon' as const,
        speciesId: item.speciesId,
        price: item.price,
        stock: 5,
        isActive: true,
      })),
    });

    return { rotated: newItems.length };
  }
}

export const shopService = new ShopService();
