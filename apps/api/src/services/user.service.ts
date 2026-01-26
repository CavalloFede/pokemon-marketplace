import { prisma } from '../lib/prisma.js';
import { INITIAL_COINS, CoinTransactionType } from '@pokemon-marketplace/shared';

export class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        pokemon: {
          where: { isInTeam: true },
          include: { species: true },
          orderBy: { teamPosition: 'asc' }
        },
        _count: {
          select: {
            pokemon: true,
            pokedex: true
          }
        }
      }
    });
  }

  /**
   * Get user by Cognito ID
   */
  async getUserByCognitoId(cognitoId: string) {
    return prisma.user.findUnique({
      where: { cognitoId }
    });
  }

  /**
   * Create new user from Cognito data
   */
  async createUser(data: {
    cognitoId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  }) {
    const user = await prisma.$transaction(async (tx) => {
      // Create user with initial coins
      const newUser = await tx.user.create({
        data: {
          cognitoId: data.cognitoId,
          email: data.email,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
          coins: INITIAL_COINS
        }
      });

      // Record initial bonus transaction
      await tx.coinTransaction.create({
        data: {
          userId: newUser.id,
          amount: INITIAL_COINS,
          type: CoinTransactionType.INITIAL_BONUS
        }
      });

      return newUser;
    });

    return user;
  }

  /**
   * Get or create user from Cognito
   */
  async getOrCreateUser(cognitoData: {
    cognitoId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  }) {
    let user = await this.getUserByCognitoId(cognitoData.cognitoId);

    if (!user) {
      user = await this.createUser(cognitoData);
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      avatarUrl?: string | null;
    }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data
    });
  }

  /**
   * Get public profile
   */
  async getPublicProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        pokemon: {
          where: { isInTeam: true },
          include: { species: true },
          orderBy: { teamPosition: 'asc' }
        },
        _count: {
          select: {
            pokemon: true,
            pokedex: true
          }
        }
      }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      team: user.pokemon,
      pokemonCount: user._count.pokemon,
      pokedexCount: user._count.pokedex,
      createdAt: user.createdAt
    };
  }

  /**
   * Get user stats
   */
  async getUserStats(userId: string) {
    const [pokemonCount, pokedexCount, tradesCompleted, shiniesCount] = await Promise.all([
      prisma.userPokemon.count({ where: { userId } }),
      prisma.userPokedex.count({ where: { userId } }),
      prisma.trade.count({
        where: {
          OR: [
            { initiatorId: userId, status: 'accepted' },
            { receiverId: userId, status: 'accepted' }
          ]
        }
      }),
      prisma.userPokemon.count({
        where: { userId, isShiny: true }
      })
    ]);

    return {
      pokemonOwned: pokemonCount,
      pokedexEntries: pokedexCount,
      pokedexPercentage: Math.round((pokedexCount / 1025) * 100 * 10) / 10,
      tradesCompleted,
      shiniesFound: shiniesCount
    };
  }
}

export const userService = new UserService();
