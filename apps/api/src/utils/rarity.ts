import { PokemonRarity, RARITY_PRICES, RARITY_THRESHOLDS, SELL_PRICE_MULTIPLIER } from '@pokemon-marketplace/shared';

interface SpeciesData {
  capture_rate: number;
  is_legendary: boolean;
  is_mythical: boolean;
}

/**
 * Calculate Pokemon rarity based on species data
 *
 * Priority:
 * 1. Mythical flag (rarest)
 * 2. Legendary flag
 * 3. Capture rate thresholds
 */
export function calculateRarity(species: SpeciesData): PokemonRarity {
  // Check flags first (highest priority)
  if (species.is_mythical) {
    return PokemonRarity.MYTHICAL;
  }

  if (species.is_legendary) {
    return PokemonRarity.LEGENDARY;
  }

  // Calculate based on capture rate
  const captureRate = species.capture_rate;

  if (captureRate >= RARITY_THRESHOLDS.COMMON_MIN) {
    return PokemonRarity.COMMON;
  }

  if (captureRate >= RARITY_THRESHOLDS.UNCOMMON_MIN) {
    return PokemonRarity.UNCOMMON;
  }

  if (captureRate >= RARITY_THRESHOLDS.RARE_MIN) {
    return PokemonRarity.RARE;
  }

  // Everything else (capture_rate <= 45) is Epic
  return PokemonRarity.EPIC;
}

/**
 * Get the base price for a Pokemon based on its rarity
 */
export function getPriceForRarity(rarity: PokemonRarity): number {
  return RARITY_PRICES[rarity];
}

/**
 * Get the sell price for a Pokemon based on its rarity
 * Returns 50% of the base price
 */
export function getSellPrice(rarity: PokemonRarity): number {
  return Math.floor(RARITY_PRICES[rarity] * SELL_PRICE_MULTIPLIER);
}

/**
 * Extract generation number from PokeAPI generation URL
 * e.g., "https://pokeapi.co/api/v2/generation/1/" -> 1
 */
export function extractGeneration(generationUrl: string): number {
  const match = generationUrl.match(/\/generation\/(\d+)\//);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Get sprite URLs from PokeAPI pokemon data
 */
export function getSpriteUrls(sprites: {
  front_default: string;
  front_shiny: string;
  other?: {
    'official-artwork'?: {
      front_default?: string;
      front_shiny?: string;
    };
  };
}): { normal: string; shiny: string } {
  // Prefer official artwork, fallback to default sprites
  const artwork = sprites.other?.['official-artwork'];

  return {
    normal: artwork?.front_default || sprites.front_default,
    shiny: artwork?.front_shiny || sprites.front_shiny
  };
}

/**
 * Extract type names from PokeAPI types array
 */
export function extractTypes(
  types: Array<{ slot: number; type: { name: string } }>
): string[] {
  return types
    .sort((a, b) => a.slot - b.slot)
    .map(t => t.type.name);
}

/**
 * Extract egg group names from PokeAPI egg_groups array
 */
export function extractEggGroups(
  eggGroups: Array<{ name: string }>
): string[] {
  return eggGroups.map(g => g.name);
}
