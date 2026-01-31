/**
 * Pokemon rarity based on capture_rate from PokeAPI
 */
export enum PokemonRarity {
  COMMON = 'common',       // capture_rate > 200
  UNCOMMON = 'uncommon',   // capture_rate 100-200
  RARE = 'rare',           // capture_rate 45-99
  EPIC = 'epic',           // capture_rate 3-44
  LEGENDARY = 'legendary', // is_legendary = true
  MYTHICAL = 'mythical'    // is_mythical = true
}

/**
 * Type of item in the shop
 */
export enum ShopItemType {
  POKEMON = 'pokemon',     // Specific pokemon
  EGG = 'egg'              // Random egg
}

/**
 * Egg categories with different pokemon pools
 */
export enum EggCategory {
  COMMON = 'common',       // Common + Uncommon pool
  RARE = 'rare',           // Rare + Epic pool
  LEGENDARY = 'legendary', // Legendary + Mythical pool
  MYSTERY = 'mystery'      // All pokemon weighted by rarity
}

/**
 * How the pokemon was obtained
 */
export enum ObtainedMethod {
  SHOP_PURCHASE = 'shop_purchase',
  EGG_HATCH = 'egg_hatch',
  TRADE = 'trade',
  DAILY_REWARD = 'daily_reward',
  EVENT = 'event',
  INITIAL = 'initial'      // Given at registration
}

/**
 * Trade status
 */
export enum TradeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

/**
 * Type of coin transaction for audit
 */
export enum CoinTransactionType {
  DAILY_REWARD = 'daily_reward',
  PURCHASE = 'purchase',
  SALE = 'sale',
  TRADE_SENT = 'trade_sent',
  TRADE_RECEIVED = 'trade_received',
  INITIAL_BONUS = 'initial_bonus',
  EVENT = 'event'
}
