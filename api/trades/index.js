import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Trade expiration in hours
const TRADE_EXPIRATION_HOURS = 24;

function parseQueryParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(value) {
  const str = parseQueryParam(value);
  if (!str) return undefined;
  const num = parseInt(str, 10);
  return isNaN(num) ? undefined : num;
}

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    // GET /api/trades - List user's trades
    if (req.method === 'GET') {
      const statusParam = parseQueryParam(req.query.status);
      const status = statusParam ? statusParam.split(',') : undefined;
      const role = parseQueryParam(req.query.role) || 'all';
      const page = parseIntParam(req.query.page) || 1;
      const pageSize = parseIntParam(req.query.pageSize) || 20;

      // Build where clause
      const where = {};

      if (role === 'initiator') {
        where.initiatorId = auth.userId;
      } else if (role === 'receiver') {
        where.receiverId = auth.userId;
      } else {
        where.OR = [
          { initiatorId: auth.userId },
          { receiverId: auth.userId }
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

      return res.status(200).json({
        data: tradesWithPokemon,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      });
    }

    // POST /api/trades - Create a new trade
    if (req.method === 'POST') {
      const {
        receiverId,
        initiatorPokemonIds = [],
        receiverPokemonIds = [],
        coinsOffered = 0,
        message
      } = req.body || {};

      // Validate: can't trade with yourself
      if (auth.userId === receiverId) {
        return res.status(400).json({ error: 'Cannot trade with yourself' });
      }

      // Validate: receiver exists
      const receiver = await prisma.user.findUnique({
        where: { id: receiverId }
      });
      if (!receiver) {
        return res.status(404).json({ error: 'Receiver not found' });
      }

      // Validate: initiator owns all pokemon
      const initiatorPokemon = await prisma.userPokemon.findMany({
        where: {
          id: { in: initiatorPokemonIds },
          userId: auth.userId
        }
      });
      if (initiatorPokemon.length !== initiatorPokemonIds.length) {
        return res.status(400).json({ error: 'Some Pokemon do not belong to you' });
      }

      // Validate: receiver owns all requested pokemon
      const receiverPokemon = await prisma.userPokemon.findMany({
        where: {
          id: { in: receiverPokemonIds },
          userId: receiverId
        }
      });
      if (receiverPokemon.length !== receiverPokemonIds.length) {
        return res.status(400).json({ error: 'Some requested Pokemon do not belong to receiver' });
      }

      // Validate: pokemon not in active trades
      const activeTrades = await prisma.trade.findMany({
        where: {
          status: 'pending',
          OR: [
            { initiatorPokemonIds: { hasSome: initiatorPokemonIds } },
            { receiverPokemonIds: { hasSome: receiverPokemonIds } },
            { initiatorPokemonIds: { hasSome: receiverPokemonIds } },
            { receiverPokemonIds: { hasSome: initiatorPokemonIds } }
          ]
        }
      });
      if (activeTrades.length > 0) {
        return res.status(400).json({ error: 'Some Pokemon are already in an active trade' });
      }

      // Validate: coins if offered
      if (coinsOffered > 0) {
        const initiator = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { coins: true }
        });
        if (!initiator || initiator.coins < coinsOffered) {
          return res.status(400).json({ error: 'Insufficient coins' });
        }
      }

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + TRADE_EXPIRATION_HOURS);

      // Create trade
      const trade = await prisma.trade.create({
        data: {
          initiatorId: auth.userId,
          receiverId,
          initiatorPokemonIds,
          receiverPokemonIds,
          coinsOffered,
          message,
          expiresAt
        }
      });

      const tradeWithDetails = await getTradeWithDetails(trade.id);
      return res.status(201).json(tradeWithDetails);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Trades error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
