import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://pokemon:pokemon123@127.0.0.1:5432/pokemon_marketplace'
    }
  }
});

try {
  await prisma.$connect();
  console.log('Database connected successfully!');
  const count = await prisma.$queryRaw`SELECT 1`;
  console.log('Query result:', count);
} catch (error) {
  console.error('Connection error:', error);
} finally {
  await prisma.$disconnect();
}
