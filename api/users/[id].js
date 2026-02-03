import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
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
          select: { pokemon: true, pokedex: true }
        }
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get additional stats
    const [pokemonStats, tradeStats] = await Promise.all([
      prisma.userPokemon.groupBy({
        by: ['isShiny'],
        where: { userId: id },
        _count: true
      }),
      prisma.trade.count({
        where: {
          OR: [{ initiatorId: id }, { receiverId: id }],
          status: 'accepted'
        }
      })
    ]);

    return res.status(200).json({
      ...user,
      stats: {
        totalPokemon: user._count.pokemon,
        pokedexCount: user._count.pokedex,
        shinyCount: pokemonStats.find(s => s.isShiny)?._count || 0,
        tradesCompleted: tradeStats
      }
    });
  } catch (error) {
    console.error('User profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
