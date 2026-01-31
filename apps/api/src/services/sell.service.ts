import { prisma } from '../lib/prisma.js';
import { CoinTransactionType } from '@pokemon-marketplace/shared';
import { getSellPrice } from '../utils/rarity.js';
import { metricsService } from './metrics.service.js';

interface SellResult {
  coinsReceived: number;
  newBalance: number;
  speciesId: number;
  speciesName: string;
}

export class SellService {
  /**
   * Sell a Pokemon for coins (50% of base rarity price)
   */
  async sellPokemon(userId: string, pokemonId: string): Promise<SellResult> {
    // Get the Pokemon with species data
    const pokemon = await prisma.userPokemon.findFirst({
      where: {
        id: pokemonId,
        userId
      },
      include: {
        species: true
      }
    });

    if (!pokemon) {
      throw new Error('Pokemon not found');
    }

    // Validate: cannot sell favorited Pokemon
    if (pokemon.isFavorite) {
      throw new Error('Cannot sell a favorite Pokemon. Remove from favorites first.');
    }

    // Validate: cannot sell Pokemon in team
    if (pokemon.isInTeam) {
      throw new Error('Cannot sell a Pokemon in your team. Remove from team first.');
    }

    // Calculate sell price based on rarity
    const sellPrice = getSellPrice(pokemon.species.rarity as any);

    // Execute transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete the Pokemon
      await tx.userPokemon.delete({
        where: { id: pokemonId }
      });

      // Add coins to user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: { increment: sellPrice }
        }
      });

      // Create coin transaction record
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: sellPrice,
          type: CoinTransactionType.SALE,
          referenceId: pokemonId
        }
      });

      // Check if user still has Pokemon of this species
      const remainingCount = await tx.userPokemon.count({
        where: {
          userId,
          speciesId: pokemon.speciesId
        }
      });

      // Update Pokedex hasCurrently if this was the last one
      if (remainingCount === 0) {
        await tx.userPokedex.update({
          where: {
            userId_speciesId: {
              userId,
              speciesId: pokemon.speciesId
            }
          },
          data: {
            hasCurrently: false
          }
        });
      }

      return {
        newBalance: updatedUser.coins,
        remainingCount
      };
    });

    // Track metrics
    await metricsService.trackCoinsEarned(sellPrice, 'sale');

    return {
      coinsReceived: sellPrice,
      newBalance: result.newBalance,
      speciesId: pokemon.speciesId,
      speciesName: pokemon.species.name
    };
  }

  /**
   * Get the sell price for a Pokemon without selling it
   */
  async getSellPricePreview(userId: string, pokemonId: string): Promise<{
    canSell: boolean;
    sellPrice: number;
    reason?: string;
  }> {
    const pokemon = await prisma.userPokemon.findFirst({
      where: {
        id: pokemonId,
        userId
      },
      include: {
        species: true
      }
    });

    if (!pokemon) {
      return {
        canSell: false,
        sellPrice: 0,
        reason: 'Pokemon not found'
      };
    }

    const sellPrice = getSellPrice(pokemon.species.rarity as any);

    if (pokemon.isFavorite) {
      return {
        canSell: false,
        sellPrice,
        reason: 'Cannot sell a favorite Pokemon'
      };
    }

    if (pokemon.isInTeam) {
      return {
        canSell: false,
        sellPrice,
        reason: 'Cannot sell a Pokemon in your team'
      };
    }

    return {
      canSell: true,
      sellPrice
    };
  }
}

export const sellService = new SellService();
