import { describe, it, expect } from 'vitest';
import {
  calculateRarity,
  getPriceForRarity,
  getSellPrice,
  extractGeneration,
  extractTypes,
  extractEggGroups,
  getSpriteUrls,
} from './rarity';
import { PokemonRarity, RARITY_PRICES, SELL_PRICE_MULTIPLIER } from '@pokemon-marketplace/shared';

describe('Rarity Utils', () => {
  describe('calculateRarity', () => {
    it('should return MYTHICAL for mythical Pokemon', () => {
      const rarity = calculateRarity({
        capture_rate: 3,
        is_legendary: false,
        is_mythical: true,
      });
      expect(rarity).toBe(PokemonRarity.MYTHICAL);
    });

    it('should return LEGENDARY for legendary Pokemon', () => {
      const rarity = calculateRarity({
        capture_rate: 3,
        is_legendary: true,
        is_mythical: false,
      });
      expect(rarity).toBe(PokemonRarity.LEGENDARY);
    });

    it('should prioritize MYTHICAL over LEGENDARY', () => {
      const rarity = calculateRarity({
        capture_rate: 3,
        is_legendary: true,
        is_mythical: true,
      });
      expect(rarity).toBe(PokemonRarity.MYTHICAL);
    });

    it('should return COMMON for high capture rates', () => {
      const rarity = calculateRarity({
        capture_rate: 255,
        is_legendary: false,
        is_mythical: false,
      });
      expect(rarity).toBe(PokemonRarity.COMMON);
    });

    it('should return UNCOMMON for medium capture rates', () => {
      const rarity = calculateRarity({
        capture_rate: 120,
        is_legendary: false,
        is_mythical: false,
      });
      expect(rarity).toBe(PokemonRarity.UNCOMMON);
    });

    it('should return RARE for lower capture rates', () => {
      const rarity = calculateRarity({
        capture_rate: 60,
        is_legendary: false,
        is_mythical: false,
      });
      expect(rarity).toBe(PokemonRarity.RARE);
    });

    it('should return EPIC for very low capture rates', () => {
      const rarity = calculateRarity({
        capture_rate: 30,
        is_legendary: false,
        is_mythical: false,
      });
      expect(rarity).toBe(PokemonRarity.EPIC);
    });
  });

  describe('getPriceForRarity', () => {
    it('should return different prices for different rarities', () => {
      const commonPrice = getPriceForRarity(PokemonRarity.COMMON);
      const legendaryPrice = getPriceForRarity(PokemonRarity.LEGENDARY);
      expect(legendaryPrice).toBeGreaterThan(commonPrice);
    });
  });

  describe('getSellPrice', () => {
    it('should return 50% of base price for each rarity', () => {
      Object.values(PokemonRarity).forEach((rarity) => {
        const sellPrice = getSellPrice(rarity);
        const expectedPrice = Math.floor(RARITY_PRICES[rarity] * SELL_PRICE_MULTIPLIER);
        expect(sellPrice).toBe(expectedPrice);
      });
    });

    it('should return correct sell price for COMMON', () => {
      const sellPrice = getSellPrice(PokemonRarity.COMMON);
      expect(sellPrice).toBe(50); // 100 * 0.5
    });

    it('should return correct sell price for LEGENDARY', () => {
      const sellPrice = getSellPrice(PokemonRarity.LEGENDARY);
      expect(sellPrice).toBe(2500); // 5000 * 0.5
    });

    it('should return correct sell price for MYTHICAL', () => {
      const sellPrice = getSellPrice(PokemonRarity.MYTHICAL);
      expect(sellPrice).toBe(5000); // 10000 * 0.5
    });

    it('should always return an integer', () => {
      Object.values(PokemonRarity).forEach((rarity) => {
        const sellPrice = getSellPrice(rarity);
        expect(Number.isInteger(sellPrice)).toBe(true);
      });
    });
  });

  describe('extractGeneration', () => {
    it('should extract generation number from URL', () => {
      const gen = extractGeneration('https://pokeapi.co/api/v2/generation/1/');
      expect(gen).toBe(1);
    });

    it('should handle different generation numbers', () => {
      expect(extractGeneration('https://pokeapi.co/api/v2/generation/5/')).toBe(5);
      expect(extractGeneration('https://pokeapi.co/api/v2/generation/8/')).toBe(8);
    });

    it('should return 1 for invalid URLs', () => {
      const gen = extractGeneration('invalid-url');
      expect(gen).toBe(1);
    });
  });

  describe('extractTypes', () => {
    it('should extract type names in order', () => {
      const types = extractTypes([
        { slot: 1, type: { name: 'fire' } },
        { slot: 2, type: { name: 'flying' } },
      ]);
      expect(types).toEqual(['fire', 'flying']);
    });

    it('should handle single type', () => {
      const types = extractTypes([{ slot: 1, type: { name: 'water' } }]);
      expect(types).toEqual(['water']);
    });

    it('should sort by slot', () => {
      const types = extractTypes([
        { slot: 2, type: { name: 'flying' } },
        { slot: 1, type: { name: 'fire' } },
      ]);
      expect(types).toEqual(['fire', 'flying']);
    });
  });

  describe('extractEggGroups', () => {
    it('should extract egg group names', () => {
      const groups = extractEggGroups([{ name: 'monster' }, { name: 'dragon' }]);
      expect(groups).toEqual(['monster', 'dragon']);
    });

    it('should handle empty array', () => {
      const groups = extractEggGroups([]);
      expect(groups).toEqual([]);
    });
  });

  describe('getSpriteUrls', () => {
    it('should prefer official artwork', () => {
      const sprites = getSpriteUrls({
        front_default: 'default.png',
        front_shiny: 'shiny-default.png',
        other: {
          'official-artwork': {
            front_default: 'official.png',
            front_shiny: 'shiny-official.png',
          },
        },
      });
      expect(sprites.normal).toBe('official.png');
      expect(sprites.shiny).toBe('shiny-official.png');
    });

    it('should fallback to default sprites', () => {
      const sprites = getSpriteUrls({
        front_default: 'default.png',
        front_shiny: 'shiny-default.png',
      });
      expect(sprites.normal).toBe('default.png');
      expect(sprites.shiny).toBe('shiny-default.png');
    });
  });
});
