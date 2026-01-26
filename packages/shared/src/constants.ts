import { PokemonRarity, EggCategory } from './enums';

// ============================================
// Pricing
// ============================================

/**
 * Base prices for each rarity tier
 */
export const RARITY_PRICES: Record<PokemonRarity, number> = {
  [PokemonRarity.COMMON]: 100,
  [PokemonRarity.UNCOMMON]: 250,
  [PokemonRarity.RARE]: 500,
  [PokemonRarity.EPIC]: 1000,
  [PokemonRarity.LEGENDARY]: 5000,
  [PokemonRarity.MYTHICAL]: 10000
};

/**
 * Egg prices by category
 */
export const EGG_PRICES: Record<EggCategory, number> = {
  [EggCategory.COMMON]: 75,
  [EggCategory.RARE]: 350,
  [EggCategory.LEGENDARY]: 2500,
  [EggCategory.MYSTERY]: 500
};

// ============================================
// Egg Probabilities
// ============================================

interface WeightedRarity {
  rarity: PokemonRarity;
  weight: number;
}

/**
 * Probability weights for each egg type
 * Weights are percentages (should sum to 100)
 */
export const EGG_WEIGHTS: Record<EggCategory, WeightedRarity[]> = {
  [EggCategory.COMMON]: [
    { rarity: PokemonRarity.COMMON, weight: 70 },
    { rarity: PokemonRarity.UNCOMMON, weight: 30 }
  ],
  [EggCategory.RARE]: [
    { rarity: PokemonRarity.RARE, weight: 70 },
    { rarity: PokemonRarity.EPIC, weight: 30 }
  ],
  [EggCategory.LEGENDARY]: [
    { rarity: PokemonRarity.LEGENDARY, weight: 90 },
    { rarity: PokemonRarity.MYTHICAL, weight: 10 }
  ],
  [EggCategory.MYSTERY]: [
    { rarity: PokemonRarity.COMMON, weight: 50 },
    { rarity: PokemonRarity.UNCOMMON, weight: 25 },
    { rarity: PokemonRarity.RARE, weight: 15 },
    { rarity: PokemonRarity.EPIC, weight: 7 },
    { rarity: PokemonRarity.LEGENDARY, weight: 2.5 },
    { rarity: PokemonRarity.MYTHICAL, weight: 0.5 }
  ]
};

// ============================================
// Daily Rewards
// ============================================

/**
 * Coins awarded by streak day
 */
export const DAILY_REWARDS: Record<number, number> = {
  1: 100,
  2: 150,
  3: 175,
  4: 200,
  5: 200  // Cap
};

/**
 * Maximum streak bonus (coins per day after day 5)
 */
export const MAX_DAILY_REWARD = 200;

/**
 * Initial coins given to new users
 */
export const INITIAL_COINS = 500;

// ============================================
// Shiny
// ============================================

/**
 * Probability of getting a shiny pokemon (1/4096)
 */
export const SHINY_RATE = 1 / 4096;

// ============================================
// Rarity Calculation
// ============================================

/**
 * Capture rate thresholds for rarity calculation
 * Based on PokeAPI capture_rate values
 */
export const RARITY_THRESHOLDS = {
  COMMON_MIN: 201,      // capture_rate > 200
  UNCOMMON_MIN: 101,    // capture_rate 101-200
  UNCOMMON_MAX: 200,
  RARE_MIN: 46,         // capture_rate 46-100
  RARE_MAX: 100,
  EPIC_MIN: 3,          // capture_rate 3-45
  EPIC_MAX: 45
  // Legendary and Mythical are determined by is_legendary/is_mythical flags
};

// ============================================
// Team
// ============================================

/**
 * Maximum pokemon in a team
 */
export const MAX_TEAM_SIZE = 6;

// ============================================
// Trades
// ============================================

/**
 * Trade expiration time in hours
 */
export const TRADE_EXPIRATION_HOURS = 24;

// ============================================
// Pagination
// ============================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============================================
// Pokemon Data
// ============================================

/**
 * Total number of pokemon species (as of Gen 9)
 */
export const TOTAL_POKEMON_SPECIES = 1025;

/**
 * Generation ranges (pokemon ID)
 */
export const GENERATIONS: Record<number, { start: number; end: number; name: string }> = {
  1: { start: 1, end: 151, name: 'Kanto' },
  2: { start: 152, end: 251, name: 'Johto' },
  3: { start: 252, end: 386, name: 'Hoenn' },
  4: { start: 387, end: 493, name: 'Sinnoh' },
  5: { start: 494, end: 649, name: 'Unova' },
  6: { start: 650, end: 721, name: 'Kalos' },
  7: { start: 722, end: 809, name: 'Alola' },
  8: { start: 810, end: 905, name: 'Galar' },
  9: { start: 906, end: 1025, name: 'Paldea' }
};
