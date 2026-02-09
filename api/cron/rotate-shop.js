import { prisma } from '../_lib/prisma.js';

export default async function handler(req, res) {
  // Verify cron secret (Vercel injects this for cron jobs)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Deactivate all current pokemon items
    await prisma.shopItem.updateMany({
      where: { itemType: 'pokemon', isActive: true },
      data: { isActive: false },
    });

    // Pick 6 random species spread across rarities
    const rarityBuckets = [
      { rarities: ['common', 'uncommon'], count: 2 },
      { rarities: ['rare', 'epic'], count: 2 },
      { rarities: ['legendary'], count: 1 },
      { rarities: ['mythical'], count: 1 },
    ];

    const newItems = [];

    for (const bucket of rarityBuckets) {
      const species = await prisma.pokemonSpecies.findMany({
        where: { rarity: { in: bucket.rarities } },
        select: { id: true, basePrice: true },
      });

      const shuffled = species.sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, bucket.count);

      for (const s of picked) {
        newItems.push({ speciesId: s.id, price: s.basePrice });
      }
    }

    // Create new shop items
    await prisma.shopItem.createMany({
      data: newItems.map((item) => ({
        itemType: 'pokemon',
        speciesId: item.speciesId,
        price: item.price,
        stock: 5,
        isActive: true,
      })),
    });

    return res.status(200).json({
      success: true,
      rotated: newItems.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Shop rotation failed:', error);
    return res.status(500).json({ error: 'Shop rotation failed' });
  }
}
