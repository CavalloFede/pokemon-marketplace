import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const samples = await prisma.pokemonSpecies.findMany({
  where: { id: { in: [1, 25, 150, 151] } },
  select: { id: true, name: true, spriteUrl: true, spriteShinyUrl: true }
});
console.log(JSON.stringify(samples, null, 2));
await prisma.$disconnect();
