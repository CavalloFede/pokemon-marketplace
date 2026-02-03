import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  try {
    const auth = await requireAuth(req);

    // GET /api/pokemon/:id
    if (req.method === 'GET') {
      const pokemon = await prisma.userPokemon.findFirst({
        where: { id, userId: auth.userId },
        include: { species: { include: { evolvesTo: true } } }
      });
      if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });
      return res.status(200).json(pokemon);
    }

    // PATCH /api/pokemon/:id
    if (req.method === 'PATCH') {
      const { nickname, isFavorite } = req.body || {};
      const updateData = {};
      if (nickname !== undefined) {
        if (nickname && (nickname.length < 1 || nickname.length > 20)) {
          return res.status(400).json({ error: 'Nickname must be between 1 and 20 characters' });
        }
        updateData.nickname = nickname || null;
      }
      if (isFavorite !== undefined) updateData.isFavorite = isFavorite;

      const pokemon = await prisma.userPokemon.findFirst({
        where: { id, userId: auth.userId }
      });
      if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });

      const updated = await prisma.userPokemon.update({
        where: { id },
        data: updateData,
        include: { species: { include: { evolvesTo: true } } }
      });
      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Pokemon by ID error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
