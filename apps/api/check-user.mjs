import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  select: { 
    id: true, 
    email: true, 
    coins: true, 
    streakDays: true, 
    lastDailyClaim: true 
  }
});
console.log('Users:', JSON.stringify(users, null, 2));

const now = new Date();
console.log('\nCurrent time:', now.toISOString());
console.log('Today:', now.toDateString());

await prisma.$disconnect();
