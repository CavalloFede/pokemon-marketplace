import { prisma } from '../lib/prisma.js';
import { coinService } from './coin.service.js';
import { TradeStatus, TRADE_EXPIRATION_HOURS } from '@pokemon-marketplace/shared';

interface TradesFilters {
  status?: TradeStatus[];
  role?: 'initiator' | 'receiver' | 'all';
  page?: number;
  pageSize?: number;
}

interface CreateTradeInput {
  receiverId: string;
  initiatorPokemonIds: string[];
  receiverPokemonIds: string[];
  coinsOffered?: number;
  message?: string;
}

export class TradeService {
  /**
   * Get user's trades
   */
  async getUserTrades(userId: string, filters: TradesFilters = {}) {
    const {
      status,
      role = 'all',
      page = 1,
      pageSize = 20
    } = filters;

    // Build where clause
    const where: any = {};

    if (role === 'initiator') {
      where.initiatorId = userId;
    } else if (role === 'receiver') {
      where.receiverId = userId;
    } else {
      where.OR = [
        { initiatorId: userId },
        { receiverId: userId }
      ];
    }

    if (status && status.length > 0) {
      where.status = { in: status };
    }

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: {
          initiator: {
            select: { id: true, displayName: true, avatarUrl: true }
          },
          receiver: {
            select: { id: true, displayName: true, avatarUrl: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.trade.count({ where })
    ]);

    // Get pokemon details for each trade
    const tradesWithPokemon = await Promise.all(
      trades.map(async (trade) => {
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
      })
    );

    return {
      data: tradesWithPokemon,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Get trade by ID
   */
  async getTradeById(tradeId: string) {
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

  /**
   * Create a new trade offer
   */
  async createTrade(initiatorId: string, input: CreateTradeInput) {
    const {
      receiverId,
      initiatorPokemonIds,
      receiverPokemonIds,
      coinsOffered = 0,
      message
    } = input;

    // Validate: can't trade with yourself
    if (initiatorId === receiverId) {
      throw new Error('Cannot trade with yourself');
    }

    // Validate: receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });
    if (!receiver) {
      throw new Error('Receiver not found');
    }

    // Validate: initiator owns all pokemon
    const initiatorPokemon = await prisma.userPokemon.findMany({
      where: {
        id: { in: initiatorPokemonIds },
        userId: initiatorId
      }
    });
    if (initiatorPokemon.length !== initiatorPokemonIds.length) {
      throw new Error('Some Pokemon do not belong to you');
    }

    // Validate: receiver owns all requested pokemon
    const receiverPokemon = await prisma.userPokemon.findMany({
      where: {
        id: { in: receiverPokemonIds },
        userId: receiverId
      }
    });
    if (receiverPokemon.length !== receiverPokemonIds.length) {
      throw new Error('Some requested Pokemon do not belong to receiver');
    }

    // Validate: pokemon not in active trades
    const activeTrades = await prisma.trade.findMany({
      where: {
        status: TradeStatus.PENDING,
        OR: [
          { initiatorPokemonIds: { hasSome: initiatorPokemonIds } },
          { receiverPokemonIds: { hasSome: receiverPokemonIds } },
          { initiatorPokemonIds: { hasSome: receiverPokemonIds } },
          { receiverPokemonIds: { hasSome: initiatorPokemonIds } }
        ]
      }
    });
    if (activeTrades.length > 0) {
      throw new Error('Some Pokemon are already in an active trade');
    }

    // Validate: coins if offered
    if (coinsOffered > 0) {
      const initiator = await prisma.user.findUnique({
        where: { id: initiatorId },
        select: { coins: true }
      });
      if (!initiator || initiator.coins < coinsOffered) {
        throw new Error('Insufficient coins');
      }
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TRADE_EXPIRATION_HOURS);

    // Create trade
    const trade = await prisma.trade.create({
      data: {
        initiatorId,
        receiverId,
        initiatorPokemonIds,
        receiverPokemonIds,
        coinsOffered,
        message,
        expiresAt
      }
    });

    return this.getTradeById(trade.id);
  }

  /**
   * Accept a trade
   */
  async acceptTrade(tradeId: string, userId: string) {
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId }
    });

    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.receiverId !== userId) {
      throw new Error('Only the receiver can accept this trade');
    }

    if (trade.status !== TradeStatus.PENDING) {
      throw new Error('Trade is not pending');
    }

    if (new Date() > trade.expiresAt) {
      await prisma.trade.update({
        where: { id: tradeId },
        data: { status: TradeStatus.EXPIRED }
      });
      throw new Error('Trade has expired');
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
        await coinService.transferCoins(
          trade.initiatorId,
          trade.receiverId,
          trade.coinsOffered,
          tradeId
        );
      }

      // Update pokedex for both users
      const allPokemonIds = [...trade.initiatorPokemonIds, ...trade.receiverPokemonIds];
      const pokemon = await tx.userPokemon.findMany({
        where: { id: { in: allPokemonIds } },
        select: { userId: true, speciesId: true }
      });

      for (const p of pokemon) {
        await tx.userPokedex.upsert({
          where: {
            userId_speciesId: { userId: p.userId, speciesId: p.speciesId }
          },
          update: {
            timesObtained: { increment: 1 }
          },
          create: {
            userId: p.userId,
            speciesId: p.speciesId
          }
        });
      }

      // Update trade status
      await tx.trade.update({
        where: { id: tradeId },
        data: {
          status: TradeStatus.ACCEPTED,
          completedAt: new Date()
        }
      });
    });

    return this.getTradeById(tradeId);
  }

  /**
   * Reject a trade
   */
  async rejectTrade(tradeId: string, userId: string) {
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId }
    });

    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.receiverId !== userId) {
      throw new Error('Only the receiver can reject this trade');
    }

    if (trade.status !== TradeStatus.PENDING) {
      throw new Error('Trade is not pending');
    }

    await prisma.trade.update({
      where: { id: tradeId },
      data: { status: TradeStatus.REJECTED }
    });

    return this.getTradeById(tradeId);
  }

  /**
   * Cancel a trade (initiator only)
   */
  async cancelTrade(tradeId: string, userId: string) {
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId }
    });

    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.initiatorId !== userId) {
      throw new Error('Only the initiator can cancel this trade');
    }

    if (trade.status !== TradeStatus.PENDING) {
      throw new Error('Trade is not pending');
    }

    await prisma.trade.update({
      where: { id: tradeId },
      data: { status: TradeStatus.CANCELLED }
    });

    return this.getTradeById(tradeId);
  }

  /**
   * Expire old trades (called by scheduler)
   */
  async expireOldTrades() {
    const result = await prisma.trade.updateMany({
      where: {
        status: TradeStatus.PENDING,
        expiresAt: { lt: new Date() }
      },
      data: { status: TradeStatus.EXPIRED }
    });

    return result.count;
  }
}

export const tradeService = new TradeService();
