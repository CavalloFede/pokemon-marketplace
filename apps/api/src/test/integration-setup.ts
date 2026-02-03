import { beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma';

// Use test database
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ||
  'postgresql://pokemon:pokemon123@localhost:5432/pokemon_marketplace_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MOCK_AUTH = 'true';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.SKIP_AUTH = 'true';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient();
  await prisma.$connect();

  // Run migrations on test database
  // Note: In CI, this should be done before tests run
  console.log('Connected to test database');
});

beforeEach(async () => {
  // Clean database before each test
  // Order matters due to foreign key constraints
  await prisma.$transaction([
    prisma.coinTransaction.deleteMany(),
    prisma.trade.deleteMany(),
    prisma.userPokemon.deleteMany(),
    prisma.userPokedex.deleteMany(),
    prisma.shopItem.deleteMany(),
    prisma.pokemonSpecies.deleteMany(),
    prisma.user.deleteMany()
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
