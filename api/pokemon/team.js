import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

const MAX_TEAM_SIZE = 6;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    // GET /api/pokemon/team
    if (req.method === 'GET') {
      const team = await prisma.userPokemon.findMany({
        where: { userId: auth.userId, isInTeam: true },
        include: { species: { include: { evolvesTo: true } } },
        orderBy: { teamPosition: 'asc' }
      });
      return res.status(200).json({ team });
    }

    // PUT /api/pokemon/team
    if (req.method === 'PUT') {
      const { pokemonIds } = req.body || {};
      if (!Array.isArray(pokemonIds)) {
        return res.status(400).json({ error: 'pokemonIds must be an array' });
      }
      if (pokemonIds.length > MAX_TEAM_SIZE) {
        return res.status(400).json({ error: `Team cannot exceed ${MAX_TEAM_SIZE} Pokemon` });
      }

      const userPokemon = await prisma.userPokemon.findMany({
        where: { id: { in: pokemonIds }, userId: auth.userId }
      });
      if (userPokemon.length !== pokemonIds.length) {
        return res.status(400).json({ error: 'Some Pokemon do not belong to you' });
      }

      const uniqueIds = new Set(pokemonIds);
      if (uniqueIds.size !== pokemonIds.length) {
        return res.status(400).json({ error: 'Duplicate Pokemon in team' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.userPokemon.updateMany({
          where: { userId: auth.userId, isInTeam: true },
          data: { isInTeam: false, teamPosition: null }
        });
        for (let i = 0; i < pokemonIds.length; i++) {
          await tx.userPokemon.update({
            where: { id: pokemonIds[i] },
            data: { isInTeam: true, teamPosition: i + 1 }
          });
        }
      });

      const team = await prisma.userPokemon.findMany({
        where: { userId: auth.userId, isInTeam: true },
        include: { species: { include: { evolvesTo: true } } },
        orderBy: { teamPosition: 'asc' }
      });
      return res.status(200).json({ team });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Pokemon team error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
