import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

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

async function getTradeWithDetails(tradeId) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: {
      initiator: { select: { id: true, displayName: true, avatarUrl: true } },
      receiver: { select: { id: true, displayName: true, avatarUrl: true } }
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

  return { ...trade, initiatorPokemon, receiverPokemon };
}

async function updateHasCurrently(userId, speciesId) {
  const count = await prisma.userPokemon.count({ where: { userId, speciesId } });
  await prisma.userPokedex.updateMany({
    where: { userId, speciesId },
    data: { hasCurrently: count > 0 }
  });
}

async function handleListTrades(req, res, auth) {
  const statusParam = parseQueryParam(req.query.status);
  const status = statusParam ? statusParam.split(',') : undefined;
  const role = parseQueryParam(req.query.role) || 'all';
  const page = parseIntParam(req.query.page) || 1;
  const pageSize = parseIntParam(req.query.pageSize) || 20;

  const where = {};
  if (role === 'initiator') where.initiatorId = auth.userId;
  else if (role === 'receiver') where.receiverId = auth.userId;
  else where.OR = [{ initiatorId: auth.userId }, { receiverId: auth.userId }];
  if (status?.length > 0) where.status = { in: status };

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      include: {
        initiator: { select: { id: true, displayName: true, avatarUrl: true } },
        receiver: { select: { id: true, displayName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.trade.count({ where })
  ]);

  const tradesWithPokemon = await Promise.all(
    trades.map(async (trade) => {
      const [initiatorPokemon, receiverPokemon] = await Promise.all([
        prisma.userPokemon.findMany({ where: { id: { in: trade.initiatorPokemonIds } }, include: { species: true } }),
        prisma.userPokemon.findMany({ where: { id: { in: trade.receiverPokemonIds } }, include: { species: true } })
      ]);
      return { ...trade, initiatorPokemon, receiverPokemon };
    })
  );

  return res.status(200).json({ data: tradesWithPokemon, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

async function handleCreateTrade(req, res, auth) {
  const { receiverId, initiatorPokemonIds = [], receiverPokemonIds = [], coinsOffered = 0, message } = req.body || {};

  if (auth.userId === receiverId) return res.status(400).json({ error: 'Cannot trade with yourself' });

  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

  const initiatorPokemon = await prisma.userPokemon.findMany({ where: { id: { in: initiatorPokemonIds }, userId: auth.userId } });
  if (initiatorPokemon.length !== initiatorPokemonIds.length) return res.status(400).json({ error: 'Some Pokemon do not belong to you' });

  const receiverPokemon = await prisma.userPokemon.findMany({ where: { id: { in: receiverPokemonIds }, userId: receiverId } });
  if (receiverPokemon.length !== receiverPokemonIds.length) return res.status(400).json({ error: 'Some requested Pokemon do not belong to receiver' });

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
  if (activeTrades.length > 0) return res.status(400).json({ error: 'Some Pokemon are already in an active trade' });

  if (coinsOffered > 0) {
    const initiator = await prisma.user.findUnique({ where: { id: auth.userId }, select: { coins: true } });
    if (!initiator || initiator.coins < coinsOffered) return res.status(400).json({ error: 'Insufficient coins' });
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TRADE_EXPIRATION_HOURS);

  const trade = await prisma.trade.create({
    data: { initiatorId: auth.userId, receiverId, initiatorPokemonIds, receiverPokemonIds, coinsOffered, message, expiresAt }
  });

  const tradeWithDetails = await getTradeWithDetails(trade.id);
  return res.status(201).json(tradeWithDetails);
}

async function handleGetTrade(req, res, auth, tradeId) {
  const trade = await getTradeWithDetails(tradeId);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.initiatorId !== auth.userId && trade.receiverId !== auth.userId) {
    return res.status(403).json({ error: 'Not authorized to view this trade' });
  }
  return res.status(200).json(trade);
}

async function handleAcceptTrade(req, res, auth, tradeId) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.receiverId !== auth.userId) return res.status(403).json({ error: 'Only the receiver can accept this trade' });
  if (trade.status !== 'pending') return res.status(400).json({ error: 'Trade is not pending' });
  if (new Date() > trade.expiresAt) {
    await prisma.trade.update({ where: { id: tradeId }, data: { status: 'expired' } });
    return res.status(400).json({ error: 'Trade has expired' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.userPokemon.updateMany({ where: { id: { in: trade.initiatorPokemonIds } }, data: { userId: trade.receiverId, isInTeam: false, teamPosition: null } });
    await tx.userPokemon.updateMany({ where: { id: { in: trade.receiverPokemonIds } }, data: { userId: trade.initiatorId, isInTeam: false, teamPosition: null } });

    if (trade.coinsOffered > 0) {
      const sender = await tx.user.findUnique({ where: { id: trade.initiatorId }, select: { coins: true } });
      if (!sender || sender.coins < trade.coinsOffered) throw new Error('Insufficient coins');
      await tx.user.update({ where: { id: trade.initiatorId }, data: { coins: { decrement: trade.coinsOffered } } });
      await tx.coinTransaction.create({ data: { userId: trade.initiatorId, amount: -trade.coinsOffered, type: 'trade_sent', referenceId: tradeId } });
      await tx.user.update({ where: { id: trade.receiverId }, data: { coins: { increment: trade.coinsOffered } } });
      await tx.coinTransaction.create({ data: { userId: trade.receiverId, amount: trade.coinsOffered, type: 'trade_received', referenceId: tradeId } });
    }

    const initiatorPokemonData = await tx.userPokemon.findMany({ where: { id: { in: trade.initiatorPokemonIds } }, select: { speciesId: true } });
    const receiverPokemonData = await tx.userPokemon.findMany({ where: { id: { in: trade.receiverPokemonIds } }, select: { speciesId: true } });

    for (const speciesId of [...new Set(initiatorPokemonData.map(p => p.speciesId))]) {
      await tx.userPokedex.upsert({
        where: { userId_speciesId: { userId: trade.receiverId, speciesId } },
        update: { timesObtained: { increment: 1 }, hasCurrently: true },
        create: { userId: trade.receiverId, speciesId, hasCurrently: true }
      });
    }
    for (const speciesId of [...new Set(receiverPokemonData.map(p => p.speciesId))]) {
      await tx.userPokedex.upsert({
        where: { userId_speciesId: { userId: trade.initiatorId, speciesId } },
        update: { timesObtained: { increment: 1 }, hasCurrently: true },
        create: { userId: trade.initiatorId, speciesId, hasCurrently: true }
      });
    }

    await tx.trade.update({ where: { id: tradeId }, data: { status: 'accepted', completedAt: new Date() } });
  });

  const initiatorPokemon = await prisma.userPokemon.findMany({ where: { id: { in: trade.initiatorPokemonIds } }, select: { speciesId: true } });
  const receiverPokemon = await prisma.userPokemon.findMany({ where: { id: { in: trade.receiverPokemonIds } }, select: { speciesId: true } });

  for (const speciesId of [...new Set(initiatorPokemon.map(p => p.speciesId))]) await updateHasCurrently(trade.initiatorId, speciesId);
  for (const speciesId of [...new Set(receiverPokemon.map(p => p.speciesId))]) await updateHasCurrently(trade.receiverId, speciesId);

  const result = await getTradeWithDetails(tradeId);
  return res.status(200).json(result);
}

async function handleRejectTrade(req, res, auth, tradeId) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.receiverId !== auth.userId) return res.status(403).json({ error: 'Only the receiver can reject this trade' });
  if (trade.status !== 'pending') return res.status(400).json({ error: 'Trade is not pending' });

  await prisma.trade.update({ where: { id: tradeId }, data: { status: 'rejected' } });
  const result = await getTradeWithDetails(tradeId);
  return res.status(200).json(result);
}

async function handleCancelTrade(req, res, auth, tradeId) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (trade.initiatorId !== auth.userId) return res.status(403).json({ error: 'Only the initiator can cancel this trade' });
  if (trade.status !== 'pending') return res.status(400).json({ error: 'Trade is not pending' });

  await prisma.trade.update({ where: { id: tradeId }, data: { status: 'cancelled' } });
  const result = await getTradeWithDetails(tradeId);
  return res.status(200).json(result);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const qp = req.query['...path'];
  const rawPath = Array.isArray(qp) ? qp : qp ? [qp] : [];
  const pathParts = rawPath[0] === '__root' ? [] : rawPath;

  try {
    const auth = await requireAuth(req);

    // GET/POST /api/trades (root)
    if (pathParts.length === 0) {
      if (req.method === 'GET') return handleListTrades(req, res, auth);
      if (req.method === 'POST') return handleCreateTrade(req, res, auth);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Routes with trade ID
    if (pathParts.length === 1) {
      const tradeId = pathParts[0];
      const action = req.query.action;

      if (action === 'accept') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleAcceptTrade(req, res, auth, tradeId);
      }
      if (action === 'reject') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleRejectTrade(req, res, auth, tradeId);
      }
      if (action === 'cancel') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return handleCancelTrade(req, res, auth, tradeId);
      }

      // GET /api/trades/:id (no action)
      if (!action) {
        if (req.method === 'GET') return handleGetTrade(req, res, auth, tradeId);
        return res.status(405).json({ error: 'Method not allowed' });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Trades error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
