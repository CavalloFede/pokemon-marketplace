import { PrismaClient } from '@prisma/client';
import { pokeApiService } from '../src/services/pokeapi.service.js';
import {
  calculateRarity,
  getPriceForRarity,
  extractGeneration,
  getSpriteUrls,
  extractTypes,
  extractEggGroups
} from '../src/utils/rarity.js';
import { EGG_PRICES } from '@pokemon-marketplace/shared';

const prisma = new PrismaClient();

async function seedPokemonSpecies() {
  console.log('Starting Pokemon species seed...\n');

  const TOTAL_POKEMON = 1025;
  const BATCH_SIZE = 50;

  // Check if already seeded
  const existingCount = await prisma.pokemonSpecies.count();
  if (existingCount >= TOTAL_POKEMON) {
    console.log(`Already have ${existingCount} Pokemon species. Skipping seed.`);
    return;
  }

  console.log(`Found ${existingCount} existing species. Will seed missing ones.\n`);

  // Get IDs that need to be seeded
  const existingIds = (await prisma.pokemonSpecies.findMany({
    select: { id: true }
  })).map(p => p.id);

  const idsToSeed = Array.from({ length: TOTAL_POKEMON }, (_, i) => i + 1)
    .filter(id => !existingIds.includes(id));

  console.log(`Need to seed ${idsToSeed.length} Pokemon species.\n`);

  let seeded = 0;
  const errors: Array<{ id: number; error: string }> = [];

  // Process in batches
  for (let i = 0; i < idsToSeed.length; i += BATCH_SIZE) {
    const batchIds = idsToSeed.slice(i, i + BATCH_SIZE);

    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(idsToSeed.length / BATCH_SIZE)} (IDs ${batchIds[0]}-${batchIds[batchIds.length - 1]})...`);

    try {
      const pokemonData = await pokeApiService.getManyPokemon(batchIds, 10);

      // Transform and insert
      const speciesData = pokemonData.map(({ pokemon, species }) => {
        const rarity = calculateRarity({
          capture_rate: species.capture_rate,
          is_legendary: species.is_legendary,
          is_mythical: species.is_mythical
        });

        const sprites = getSpriteUrls(pokemon.sprites);

        return {
          id: pokemon.id,
          name: pokemon.name,
          spriteUrl: sprites.normal,
          spriteShinyUrl: sprites.shiny,
          types: extractTypes(pokemon.types),
          rarity,
          basePrice: getPriceForRarity(rarity),
          captureRate: species.capture_rate,
          isLegendary: species.is_legendary,
          isMythical: species.is_mythical,
          generation: extractGeneration(species.generation.url),
          eggGroups: extractEggGroups(species.egg_groups)
        };
      });

      // Upsert each pokemon
      for (const data of speciesData) {
        try {
          await prisma.pokemonSpecies.upsert({
            where: { id: data.id },
            update: data,
            create: data
          });
          seeded++;
        } catch (error) {
          errors.push({
            id: data.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`  Seeded ${seeded}/${idsToSeed.length} Pokemon`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  Batch error:`, error);
      // Continue with next batch
    }
  }

  console.log(`\nSeed complete! Seeded ${seeded} Pokemon species.`);

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    errors.forEach(e => console.log(`  - Pokemon #${e.id}: ${e.error}`));
  }

  // Print rarity distribution
  const distribution = await prisma.pokemonSpecies.groupBy({
    by: ['rarity'],
    _count: { id: true }
  });

  console.log('\nRarity distribution:');
  distribution.forEach(d => {
    console.log(`  ${d.rarity}: ${d._count.id}`);
  });
}

async function seedShopItems() {
  console.log('\nSeeding shop items...\n');

  // Check if already seeded
  const existingCount = await prisma.shopItem.count();
  if (existingCount > 0) {
    console.log(`Already have ${existingCount} shop items. Skipping.`);
    return;
  }

  // Create egg items
  const eggItems = [
    {
      itemType: 'egg' as const,
      eggCategory: 'common' as const,
      price: EGG_PRICES.common,
      isActive: true
    },
    {
      itemType: 'egg' as const,
      eggCategory: 'rare' as const,
      price: EGG_PRICES.rare,
      isActive: true
    },
    {
      itemType: 'egg' as const,
      eggCategory: 'legendary' as const,
      price: EGG_PRICES.legendary,
      isActive: true
    },
    {
      itemType: 'egg' as const,
      eggCategory: 'mystery' as const,
      price: EGG_PRICES.mystery,
      isActive: true
    }
  ];

  for (const item of eggItems) {
    await prisma.shopItem.create({ data: item });
  }

  console.log(`Created ${eggItems.length} egg items in shop.`);

  // Create some featured Pokemon (starters from each gen)
  const starterIds = [
    1, 4, 7,      // Gen 1: Bulbasaur, Charmander, Squirtle
    152, 155, 158, // Gen 2: Chikorita, Cyndaquil, Totodile
    252, 255, 258, // Gen 3: Treecko, Torchic, Mudkip
    387, 390, 393  // Gen 4: Turtwig, Chimchar, Piplup
  ];

  for (const speciesId of starterIds) {
    const species = await prisma.pokemonSpecies.findUnique({
      where: { id: speciesId }
    });

    if (species) {
      await prisma.shopItem.create({
        data: {
          itemType: 'pokemon',
          speciesId: species.id,
          price: species.basePrice,
          isActive: true
        }
      });
    }
  }

  console.log(`Created ${starterIds.length} featured Pokemon in shop.`);
}

async function main() {
  try {
    await seedPokemonSpecies();
    await seedShopItems();
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
