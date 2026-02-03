import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

function parseQueryParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntParam(value) {
  const str = parseQueryParam(value);
  if (!str) return undefined;
  const num = parseInt(str, 10);
  return isNaN(num) ? undefined : num;
}

function parseBoolParam(value) {
  const str = parseQueryParam(value);
  if (str === 'true') return true;
  if (str === 'false') return false;
  return undefined;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await requireAuth(req);

    const {
      rarity,
      types,
      isInTeam,
      isFavorite,
      isShiny,
      search,
      sortBy = 'obtainedAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20
    } = {
      rarity: parseQueryParam(req.query.rarity)?.split(','),
      types: parseQueryParam(req.query.types)?.split(','),
      isInTeam: parseBoolParam(req.query.isInTeam),
      isFavorite: parseBoolParam(req.query.isFavorite),
      isShiny: parseBoolParam(req.query.isShiny),
      search: parseQueryParam(req.query.search),
      sortBy: parseQueryParam(req.query.sortBy) || 'obtainedAt',
      sortOrder: parseQueryParam(req.query.sortOrder) || 'desc',
      page: parseIntParam(req.query.page) || 1,
      pageSize: parseIntParam(req.query.pageSize) || 20
    };

    const where = { userId: auth.userId };
    if (isInTeam !== undefined) where.isInTeam = isInTeam;
    if (isFavorite !== undefined) where.isFavorite = isFavorite;
    if (isShiny !== undefined) where.isShiny = isShiny;
    if (rarity?.length) where.species = { ...where.species, rarity: { in: rarity } };
    if (types?.length) where.species = { ...where.species, types: { hasSome: types } };
    if (search) {
      where.OR = [
        { nickname: { contains: search, mode: 'insensitive' } },
        { species: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    let orderBy;
    switch (sortBy) {
      case 'name': orderBy = { species: { name: sortOrder } }; break;
      case 'rarity': orderBy = { species: { rarity: sortOrder } }; break;
      case 'speciesId': orderBy = { speciesId: sortOrder }; break;
      default: orderBy = { obtainedAt: sortOrder };
    }

    const [pokemon, total] = await Promise.all([
      prisma.userPokemon.findMany({
        where,
        include: { species: { include: { evolvesTo: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.userPokemon.count({ where })
    ]);

    return res.status(200).json({
      data: pokemon,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Pokemon collection error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
