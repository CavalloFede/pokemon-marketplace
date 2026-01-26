// Note: Zod will be installed in each app that needs validation
// These are the schema definitions that can be imported

import { EggCategory, TradeStatus } from './enums';
import { MAX_TEAM_SIZE, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from './constants';

// ============================================
// Schema Type Definitions (for documentation)
// Actual Zod schemas will be created in apps
// ============================================

/**
 * Schema for updating user profile
 */
export interface UpdateUserInput {
  displayName?: string;  // 2-30 characters
  avatarUrl?: string;    // Valid URL or null
}

/**
 * Schema for purchasing from shop
 */
export interface PurchaseInput {
  itemId: string;        // UUID of shop item
}

/**
 * Schema for creating a trade
 */
export interface CreateTradeInput {
  receiverId: string;              // UUID of receiver
  initiatorPokemonIds: string[];   // 1-6 pokemon UUIDs
  receiverPokemonIds: string[];    // 1-6 pokemon UUIDs
  coinsOffered?: number;           // 0 or positive integer
  message?: string;                // Max 500 characters
}

/**
 * Schema for updating pokemon
 */
export interface UpdatePokemonInput {
  nickname?: string | null;  // 1-20 characters or null
  isFavorite?: boolean;
}

/**
 * Schema for updating team
 */
export interface UpdateTeamInput {
  pokemonIds: string[];  // 0-6 pokemon UUIDs, ordered by position
}

/**
 * Schema for pagination query params
 */
export interface PaginationInput {
  page?: number;      // Min 1, default 1
  pageSize?: number;  // Min 1, max MAX_PAGE_SIZE, default DEFAULT_PAGE_SIZE
}

/**
 * Schema for collection filters
 */
export interface CollectionFiltersInput extends PaginationInput {
  rarity?: string[];       // Filter by rarity
  types?: string[];        // Filter by pokemon type
  isInTeam?: boolean;      // Filter by team membership
  isFavorite?: boolean;    // Filter by favorite status
  isShiny?: boolean;       // Filter by shiny status
  search?: string;         // Search by name/nickname
  sortBy?: 'name' | 'obtainedAt' | 'rarity' | 'speciesId';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Schema for pokedex filters
 */
export interface PokedexFiltersInput extends PaginationInput {
  generation?: number;     // Filter by generation
  types?: string[];        // Filter by pokemon type
  obtained?: boolean;      // Filter by obtained status
  search?: string;         // Search by name
}

/**
 * Schema for trades filters
 */
export interface TradesFiltersInput extends PaginationInput {
  status?: TradeStatus[];  // Filter by status
  role?: 'initiator' | 'receiver' | 'all';
}

// ============================================
// Validation Constants
// ============================================

export const VALIDATION = {
  displayName: {
    minLength: 2,
    maxLength: 30
  },
  nickname: {
    minLength: 1,
    maxLength: 20
  },
  tradeMessage: {
    maxLength: 500
  },
  team: {
    maxSize: MAX_TEAM_SIZE
  },
  pagination: {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    maxPageSize: MAX_PAGE_SIZE
  }
} as const;
