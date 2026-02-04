import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthError } from '../_lib/auth.js';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
globalForPrisma.prisma = prisma;

// Constants
const MAX_TEAM_SIZE = 6;
const BASE_EXP_PER_LEVEL = 100;
const EXP_GROWTH_RATE = 1.15;
const MAX_LEVEL = 100;
const PASSIVE_EXP_PER_HOUR = 10;
const MAX_PASSIVE_HOURS = 24;
const RARITY_PRICES = {
  common: 100, uncommon: 250, rare: 500, epic: 1000, legendary: 5000, mythical: 10000
};
const SELL_PRICE_MULTIPLIER = 0.5;

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

function getExpForLevel(level) {
  if (level <= 1) return 0;
  let totalExp = 0;
  for (let i = 2; i <= level; i++) {
    totalExp += Math.floor(BASE_EXP_PER_LEVEL * Math.pow(EXP_GROWTH_RATE, i - 2));
  }
  return totalExp;
}

function calculateLevelInfo(baseLevel, baseExp, lastExpGainAt) {
  const now = new Date();
  const hoursSince = lastExpGainAt
    ? (now.getTime() - new Date(lastExpGainAt).getTime()) / (1000 * 60 * 60)
    : 0;
  const passiveHours = Math.min(hoursSince, MAX_PASSIVE_HOURS);
  const passiveExp = Math.floor(passiveHours * PASSIVE_EXP_PER_HOUR);
  const totalExp = baseExp + passiveExp;

  let level = baseLevel;
  let expForNext = getExpForLevel(level + 1);
  while (totalExp >= expForNext && level < MAX_LEVEL) {
    level++;
    expForNext = getExpForLevel(level + 1);
  }

  return { level, totalExp };
}

function getSellPrice(rarity) {
  return Math.floor((RARITY_PRICES[rarity] || 100) * SELL_PRICE_MULTIPLIER);
}

// ---- Route handlers ----

async function handleListPokemon(req, res, auth) {
  const rarity = parseQueryParam(req.query.rarity)?.split(',');
  const types = parseQueryParam(req.query.types)?.split(',');
  const isInTeam = parseBoolParam(req.query.isInTeam);
  const isFavorite = parseBoolParam(req.query.isFavorite);
  const isShiny = parseBoolParam(req.query.isShiny);
  const search = parseQueryParam(req.query.search);
  const sortBy = parseQueryParam(req.query.sortBy) || 'obtainedAt';
  const sortOrder = parseQueryParam(req.query.sortOrder) || 'desc';
  const page = parseIntParam(req.query.page) || 1;
  const pageSize = parseIntParam(req.query.pageSize) || 20;

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
    data: pokemon, total, page, pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
}

async function handleTeam(req, res, auth) {
  if (req.method === 'GET') {
    const team = await prisma.userPokemon.findMany({
      where: { userId: auth.userId, isInTeam: true },
      include: { species: { include: { evolvesTo: true } } },
      orderBy: { teamPosition: 'asc' }
    });
    return res.status(200).json({ team });
  }

  if (req.method === 'PUT') {
    const { pokemonIds } = req.body || {};
    if (!Array.isArray(pokemonIds)) return res.status(400).json({ error: 'pokemonIds must be an array' });
    if (pokemonIds.length > MAX_TEAM_SIZE) return res.status(400).json({ error: `Team cannot exceed ${MAX_TEAM_SIZE} Pokemon` });

    const userPokemon = await prisma.userPokemon.findMany({
      where: { id: { in: pokemonIds }, userId: auth.userId }
    });
    if (userPokemon.length !== pokemonIds.length) return res.status(400).json({ error: 'Some Pokemon do not belong to you' });

    const uniqueIds = new Set(pokemonIds);
    if (uniqueIds.size !== pokemonIds.length) return res.status(400).json({ error: 'Duplicate Pokemon in team' });

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
}

async function handleEvolutionReady(req, res, auth) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pokemon = await prisma.userPokemon.findMany({
    where: { userId: auth.userId, suppressEvolutionNotification: false },
    include: { species: { include: { evolvesTo: true } } }
  });

  const readyPokemon = [];
  for (const p of pokemon) {
    if (p.species.evolvesTo.length === 0) continue;
    const evolutionTarget = p.species.evolvesTo[0];
    if (!evolutionTarget.evolutionLevel) continue;

    const levelInfo = calculateLevelInfo(p.level, p.experience, p.lastExperienceGainAt);
    if (levelInfo.level >= evolutionTarget.evolutionLevel) {
      readyPokemon.push({
        id: p.id, nickname: p.nickname, isShiny: p.isShiny, level: levelInfo.level,
        currentSpecies: {
          id: p.species.id, name: p.species.name,
          spriteUrl: p.species.spriteUrl, spriteShinyUrl: p.species.spriteShinyUrl
        },
        targetSpecies: {
          id: evolutionTarget.id, name: evolutionTarget.name,
          spriteUrl: evolutionTarget.spriteUrl, spriteShinyUrl: evolutionTarget.spriteShinyUrl,
          evolutionLevel: evolutionTarget.evolutionLevel
        }
      });
    }
  }

  return res.status(200).json({ pokemon: readyPokemon });
}

async function handlePokemonById(req, res, auth, pokemonId) {
  if (req.method === 'GET') {
    const pokemon = await prisma.userPokemon.findFirst({
      where: { id: pokemonId, userId: auth.userId },
      include: { species: { include: { evolvesTo: true } } }
    });
    if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });
    return res.status(200).json(pokemon);
  }

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

    const pokemon = await prisma.userPokemon.findFirst({ where: { id: pokemonId, userId: auth.userId } });
    if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });

    const updated = await prisma.userPokemon.update({
      where: { id: pokemonId },
      data: updateData,
      include: { species: { include: { evolvesTo: true } } }
    });
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleSell(req, res, auth, pokemonId) {
  const pokemon = await prisma.userPokemon.findFirst({
    where: { id: pokemonId, userId: auth.userId },
    include: { species: true }
  });
  if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });

  if (req.method === 'GET') {
    const sellPrice = getSellPrice(pokemon.species.rarity);
    if (pokemon.isFavorite) return res.status(200).json({ canSell: false, sellPrice, reason: 'Pokemon is favorited' });
    if (pokemon.isInTeam) return res.status(200).json({ canSell: false, sellPrice, reason: 'Pokemon is in team' });
    return res.status(200).json({ canSell: true, sellPrice });
  }

  if (req.method === 'POST') {
    if (pokemon.isFavorite) return res.status(400).json({ error: 'Cannot sell a favorite Pokemon. Remove from favorites first.' });
    if (pokemon.isInTeam) return res.status(400).json({ error: 'Cannot sell a Pokemon in your team. Remove from team first.' });

    const sellPrice = getSellPrice(pokemon.species.rarity);

    const result = await prisma.$transaction(async (tx) => {
      await tx.userPokemon.delete({ where: { id: pokemonId } });
      const updatedUser = await tx.user.update({
        where: { id: auth.userId },
        data: { coins: { increment: sellPrice } }
      });
      await tx.coinTransaction.create({
        data: { userId: auth.userId, amount: sellPrice, type: 'sale', referenceId: pokemonId }
      });
      const remainingCount = await tx.userPokemon.count({
        where: { userId: auth.userId, speciesId: pokemon.speciesId }
      });
      if (remainingCount === 0) {
        await tx.userPokedex.updateMany({
          where: { userId: auth.userId, speciesId: pokemon.speciesId },
          data: { hasCurrently: false }
        });
      }
      return updatedUser;
    });

    return res.status(200).json({
      success: true, coinsReceived: sellPrice, newBalance: result.coins,
      soldPokemon: { speciesId: pokemon.speciesId, speciesName: pokemon.species.name }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleEvolve(req, res, auth, pokemonId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pokemon = await prisma.userPokemon.findFirst({
    where: { id: pokemonId, userId: auth.userId },
    include: { species: { include: { evolvesTo: true } } }
  });
  if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });

  if (pokemon.species.evolvesTo.length === 0) return res.status(400).json({ error: 'This Pokemon cannot evolve' });

  const evolutionTarget = pokemon.species.evolvesTo[0];
  const levelInfo = calculateLevelInfo(pokemon.level, pokemon.experience, pokemon.lastExperienceGainAt);

  if (evolutionTarget.evolutionLevel && levelInfo.level < evolutionTarget.evolutionLevel) {
    return res.status(400).json({
      error: `Level ${evolutionTarget.evolutionLevel} required to evolve. Current level: ${levelInfo.level}`
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedPokemon = await tx.userPokemon.update({
      where: { id: pokemonId },
      data: {
        speciesId: evolutionTarget.id, level: levelInfo.level,
        experience: levelInfo.totalExp, lastExperienceGainAt: new Date()
      },
      include: { species: true }
    });

    const existingEntry = await tx.userPokedex.findUnique({
      where: { userId_speciesId: { userId: auth.userId, speciesId: evolutionTarget.id } }
    });
    const isNewPokedexEntry = !existingEntry;

    if (existingEntry) {
      await tx.userPokedex.update({
        where: { userId_speciesId: { userId: auth.userId, speciesId: evolutionTarget.id } },
        data: { timesObtained: { increment: 1 }, hasCurrently: true }
      });
    } else {
      await tx.userPokedex.create({
        data: { userId: auth.userId, speciesId: evolutionTarget.id, hasCurrently: true }
      });
    }

    const remainingPrevious = await tx.userPokemon.count({
      where: { userId: auth.userId, speciesId: pokemon.speciesId }
    });
    if (remainingPrevious === 0) {
      await tx.userPokedex.updateMany({
        where: { userId: auth.userId, speciesId: pokemon.speciesId },
        data: { hasCurrently: false }
      });
    }

    return { updatedPokemon, isNewPokedexEntry };
  });

  return res.status(200).json({
    success: true,
    pokemon: {
      id: result.updatedPokemon.id,
      previousSpeciesId: pokemon.speciesId,
      previousSpeciesName: pokemon.species.name,
      newSpeciesId: evolutionTarget.id,
      newSpeciesName: evolutionTarget.name,
      isShiny: pokemon.isShiny,
      level: levelInfo.level
    },
    isNewPokedexEntry: result.isNewPokedexEntry
  });
}

async function handleEvolutionSettings(req, res, auth, pokemonId) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { suppressNotification } = req.body || {};
  if (typeof suppressNotification !== 'boolean') {
    return res.status(400).json({ error: 'suppressNotification must be a boolean' });
  }

  const pokemon = await prisma.userPokemon.findFirst({ where: { id: pokemonId, userId: auth.userId } });
  if (!pokemon) return res.status(404).json({ error: 'Pokemon not found' });

  await prisma.userPokemon.update({
    where: { id: pokemonId },
    data: { suppressEvolutionNotification: suppressNotification }
  });

  return res.status(200).json({ success: true });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const qp = req.query['...path'];
  const rawPath = Array.isArray(qp) ? qp : qp ? [qp] : [];
  const pathParts = rawPath[0] === '__root' ? [] : rawPath;

  try {
    const auth = await requireAuth(req);

    // GET /api/pokemon (root - list collection)
    if (pathParts.length === 0) {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      return handleListPokemon(req, res, auth);
    }

    // GET/PUT /api/pokemon/team
    if (pathParts[0] === 'team' && pathParts.length === 1) {
      return handleTeam(req, res, auth);
    }

    // GET /api/pokemon/evolution-ready
    if (pathParts[0] === 'evolution-ready' && pathParts.length === 1) {
      return handleEvolutionReady(req, res, auth);
    }

    // Routes with pokemon ID
    if (pathParts.length === 1) {
      const pokemonId = pathParts[0];
      const action = req.query.action;

      if (action === 'sell') return handleSell(req, res, auth, pokemonId);
      if (action === 'evolve') return handleEvolve(req, res, auth, pokemonId);
      if (action === 'evolution-settings') return handleEvolutionSettings(req, res, auth, pokemonId);

      // GET/PATCH /api/pokemon/:id (no action)
      if (!action) return handlePokemonById(req, res, auth, pokemonId);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Pokemon error:', error);
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
