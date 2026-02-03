import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { id: pokemonId } = req.query;

  try {
    const auth = await requireAuth(req);

    const { suppressNotification } = req.body || {};
    if (typeof suppressNotification !== 'boolean') {
      return res.status(400).json({ error: 'suppressNotification must be a boolean' });
    }

    const pokemon = await prisma.userPokemon.findFirst({
      where: { id: pokemonId, userId: auth.userId }
    });

    if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });

    await prisma.userPokemon.update({
      where: { id: pokemonId },
      data: { suppressEvolutionNotification: suppressNotification }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Evolution settings error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
