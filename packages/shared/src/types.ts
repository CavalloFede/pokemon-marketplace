import type {
  PokemonRarity,
  EggCategory,
  ObtainedMethod,
  TradeStatus,
  ShopItemType
} from './enums.js';

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  coins: number;
  streakDays: number;
  lastDailyClaim: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  team: UserPokemon[];
  pokedexCount: number;
  createdAt: Date;
}

// ============================================
// Pokemon Types
// ============================================

export interface PokemonSpecies {
  id: number;
  name: string;
  spriteUrl: string;
  spriteShinyUrl: string;
  types: string[];
  rarity: PokemonRarity;
  basePrice: number;
  captureRate: number;
  isLegendary: boolean;
  isMythical: boolean;
  generation: number;
  eggGroups: string[];
  // Evolution data
  evolvesFromId: number | null;
  evolutionLevel: number | null;
  evolvesTo?: PokemonSpecies[];
}

export interface UserPokemon {
  id: string;
  userId: string;
  speciesId: number;
  species: PokemonSpecies;
  nickname: string | null;
  isShiny: boolean;
  isInTeam: boolean;
  teamPosition: number | null;
  isFavorite: boolean;
  obtainedMethod: ObtainedMethod;
  obtainedAt: Date;
  // Leveling system
  level: number;
  experience: number;
  lastExperienceGainAt: Date;
  // Evolution settings
  suppressEvolutionNotification: boolean;
  // Computed level info (optional, added by API)
  levelInfo?: LevelInfo;
}

export interface LevelInfo {
  level: number;
  experience: number;
  expToNextLevel: number;
  expProgress: number;
  isMaxLevel: boolean;
}

export interface PokedexEntry {
  speciesId: number;
  species: PokemonSpecies;
  obtained: boolean;
  firstObtainedAt: Date | null;
  timesObtained: number;
  // Seen vs Owned tracking
  seen: boolean;        // true if ever obtained
  owned: boolean;       // true if currently has at least one
  hasCurrently: boolean; // alias for owned
}

// ============================================
// Shop Types
// ============================================

export interface ShopItem {
  id: string;
  itemType: ShopItemType;
  speciesId: number | null;
  species: PokemonSpecies | null;
  eggCategory: EggCategory | null;
  price: number;
  stock: number | null;
  isActive: boolean;
}

export interface PurchaseResult {
  pokemon: UserPokemon;
  newBalance: number;
  isNewPokedexEntry: boolean;
}

export interface EggHatchResult extends PurchaseResult {
  eggCategory: EggCategory;
  rolledRarity: PokemonRarity;
}

export interface SellResult {
  success: boolean;
  coinsReceived: number;
  newBalance: number;
  soldPokemon: {
    speciesId: number;
    speciesName: string;
  };
}

export interface SellPreview {
  pokemonId: string;
  speciesName: string;
  isShiny: boolean;
  sellPrice: number;
  rarity: PokemonRarity;
  canSell: boolean;
  reason?: string;
}

// ============================================
// Evolution Types
// ============================================

export interface EvolutionResult {
  success: boolean;
  pokemon: {
    id: string;
    previousSpeciesId: number;
    previousSpeciesName: string;
    newSpeciesId: number;
    newSpeciesName: string;
    isShiny: boolean;
    level: number;
  };
  isNewPokedexEntry: boolean;
}

export interface EvolutionReadyPokemon {
  id: string;
  nickname: string | null;
  isShiny: boolean;
  level: number;
  currentSpecies: {
    id: number;
    name: string;
    spriteUrl: string;
    spriteShinyUrl: string;
  };
  targetSpecies: {
    id: number;
    name: string;
    spriteUrl: string;
    spriteShinyUrl: string;
    evolutionLevel: number;
  };
}

// ============================================
// Trade Types
// ============================================

export interface Trade {
  id: string;
  initiatorId: string;
  initiator: PublicUser;
  receiverId: string;
  receiver: PublicUser;
  status: TradeStatus;
  initiatorPokemonIds: string[];
  initiatorPokemon: UserPokemon[];
  receiverPokemonIds: string[];
  receiverPokemon: UserPokemon[];
  coinsOffered: number;
  message: string | null;
  createdAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
}

export interface CreateTradeInput {
  receiverId: string;
  initiatorPokemonIds: string[];
  receiverPokemonIds: string[];
  coinsOffered?: number;
  message?: string;
}

// ============================================
// API Response Types
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DailyRewardResult {
  coinsAwarded: number;
  newBalance: number;
  streakDay: number;
  nextClaimAt: Date;
}

export interface PokedexStats {
  totalSpecies: number;
  obtained: number;       // Legacy: same as seen
  seen: number;           // Ever obtained
  owned: number;          // Currently has
  percentage: number;     // Legacy: same as seenPercentage
  seenPercentage: number;
  ownedPercentage: number;
  byGeneration: Record<number, { total: number; obtained: number }>;
  byType: Record<string, { total: number; obtained: number }>;
  byRarity: Record<PokemonRarity, { total: number; obtained: number }>;
}

// ============================================
// PokeAPI Response Types (external)
// ============================================

export interface PokeAPIPokemon {
  id: number;
  name: string;
  sprites: {
    front_default: string;
    front_shiny: string;
    other: {
      'official-artwork': {
        front_default: string;
        front_shiny: string;
      };
    };
  };
  types: Array<{
    slot: number;
    type: {
      name: string;
      url: string;
    };
  }>;
}

export interface PokeAPISpecies {
  id: number;
  name: string;
  capture_rate: number;
  is_legendary: boolean;
  is_mythical: boolean;
  generation: {
    name: string;
    url: string;
  };
  egg_groups: Array<{
    name: string;
    url: string;
  }>;
  evolution_chain: {
    url: string;
  };
  evolves_from_species: {
    name: string;
    url: string;
  } | null;
}
