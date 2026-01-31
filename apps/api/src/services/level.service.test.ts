import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelService } from './level.service.js';
import { MAX_LEVEL, getExpForLevel } from '@pokemon-marketplace/shared';

// Mock Prisma
const mockPrisma = {
  userPokemon: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  pokemonSpecies: {
    findUnique: vi.fn()
  }
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma
}));

describe('LevelService', () => {
  let levelService: LevelService;

  beforeEach(() => {
    vi.clearAllMocks();
    levelService = new LevelService();
  });

  describe('calculateLevelInfo', () => {
    it('should return level 1 for new Pokemon with 0 exp', () => {
      const now = new Date();
      const result = levelService.calculateLevelInfo(1, 0, now);

      expect(result.level).toBe(1);
      expect(result.experience).toBeGreaterThanOrEqual(0);
      expect(result.isMaxLevel).toBe(false);
    });

    it('should calculate passive exp based on time elapsed', () => {
      // 10 hours ago
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
      const result = levelService.calculateLevelInfo(1, 0, tenHoursAgo);

      // Should have gained some passive exp
      expect(result.experience).toBeGreaterThan(0);
    });

    it('should cap level at MAX_LEVEL', () => {
      const now = new Date();
      const hugeExp = getExpForLevel(MAX_LEVEL + 10); // More than max level exp
      const result = levelService.calculateLevelInfo(MAX_LEVEL, hugeExp, now);

      expect(result.level).toBe(MAX_LEVEL);
      expect(result.isMaxLevel).toBe(true);
      expect(result.expProgress).toBe(100);
    });

    it('should calculate correct exp progress percentage', () => {
      const now = new Date();
      // Level 5 needs 250 exp, level 6 needs 360 exp
      // At 300 exp, should be between level 5 and 6
      const result = levelService.calculateLevelInfo(5, 300, now);

      expect(result.expProgress).toBeGreaterThan(0);
      expect(result.expProgress).toBeLessThan(100);
    });

    it('should have diminishing exp returns at higher levels', () => {
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);

      const lowLevelResult = levelService.calculateLevelInfo(1, 0, tenHoursAgo);
      const highLevelResult = levelService.calculateLevelInfo(50, 0, tenHoursAgo);

      // Lower level should gain more exp per hour
      expect(lowLevelResult.experience).toBeGreaterThan(0);
      expect(highLevelResult.experience).toBeGreaterThan(0);
      // The high level pokemon gains less passive exp due to diminishing returns
      expect(lowLevelResult.experience).toBeGreaterThan(highLevelResult.experience);
    });
  });

  describe('getInitialLevel', () => {
    it('should return 1 for base Pokemon', async () => {
      mockPrisma.pokemonSpecies.findUnique.mockResolvedValue({
        id: 1,
        name: 'bulbasaur',
        evolvesFromId: null,
        evolutionLevel: null
      });

      const level = await levelService.getInitialLevel(1);
      expect(level).toBe(1);
    });

    it('should return evolution level for evolved Pokemon', async () => {
      mockPrisma.pokemonSpecies.findUnique.mockResolvedValue({
        id: 2,
        name: 'ivysaur',
        evolvesFromId: 1,
        evolutionLevel: 16
      });

      const level = await levelService.getInitialLevel(2);
      expect(level).toBe(16);
    });

    it('should return 1 for unknown species', async () => {
      mockPrisma.pokemonSpecies.findUnique.mockResolvedValue(null);

      const level = await levelService.getInitialLevel(9999);
      expect(level).toBe(1);
    });
  });

  describe('updatePokemonLevel', () => {
    it('should return null if Pokemon not found', async () => {
      mockPrisma.userPokemon.findUnique.mockResolvedValue(null);

      const result = await levelService.updatePokemonLevel('invalid-id');
      expect(result).toBeNull();
    });

    it('should update Pokemon level when exp has accumulated', async () => {
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);

      mockPrisma.userPokemon.findUnique.mockResolvedValue({
        id: 'pokemon-1',
        level: 1,
        experience: 0,
        lastExperienceGainAt: tenHoursAgo,
        species: { id: 25, name: 'pikachu' }
      });
      mockPrisma.userPokemon.update.mockResolvedValue({});

      const result = await levelService.updatePokemonLevel('pokemon-1');

      // Should have updated
      expect(mockPrisma.userPokemon.update).toHaveBeenCalled();
    });

    it('should return level up info when levels gained', async () => {
      // 100 hours ago - should gain significant exp
      const longTimeAgo = new Date(Date.now() - 100 * 60 * 60 * 1000);

      mockPrisma.userPokemon.findUnique.mockResolvedValue({
        id: 'pokemon-1',
        level: 1,
        experience: 0,
        lastExperienceGainAt: longTimeAgo,
        species: { id: 25, name: 'pikachu' }
      });
      mockPrisma.userPokemon.update.mockResolvedValue({});

      const result = await levelService.updatePokemonLevel('pokemon-1');

      if (result) {
        expect(result.previousLevel).toBe(1);
        expect(result.newLevel).toBeGreaterThan(1);
        expect(result.levelsGained).toBeGreaterThan(0);
      }
    });
  });

  describe('canEvolve', () => {
    it('should return false if Pokemon not found', async () => {
      mockPrisma.userPokemon.findUnique.mockResolvedValue(null);

      const result = await levelService.canEvolve('invalid-id');
      expect(result.canEvolve).toBe(false);
    });

    it('should return false if no evolution available', async () => {
      mockPrisma.userPokemon.findUnique.mockResolvedValue({
        id: 'pokemon-1',
        level: 100,
        experience: 100000,
        lastExperienceGainAt: new Date(),
        species: {
          id: 3,
          name: 'venusaur',
          evolvesTo: [] // No evolution
        }
      });

      const result = await levelService.canEvolve('pokemon-1');
      expect(result.canEvolve).toBe(false);
    });

    it('should return true if level meets evolution requirement', async () => {
      mockPrisma.userPokemon.findUnique.mockResolvedValue({
        id: 'pokemon-1',
        level: 20,
        experience: 4000,
        lastExperienceGainAt: new Date(),
        species: {
          id: 1,
          name: 'bulbasaur',
          evolvesTo: [{
            id: 2,
            name: 'ivysaur',
            evolutionLevel: 16
          }]
        }
      });

      const result = await levelService.canEvolve('pokemon-1');

      expect(result.canEvolve).toBe(true);
      expect(result.targetSpeciesId).toBe(2);
      expect(result.targetSpeciesName).toBe('ivysaur');
      expect(result.requiredLevel).toBe(16);
    });

    it('should return false if level below evolution requirement', async () => {
      mockPrisma.userPokemon.findUnique.mockResolvedValue({
        id: 'pokemon-1',
        level: 10,
        experience: 1000,
        lastExperienceGainAt: new Date(),
        species: {
          id: 1,
          name: 'bulbasaur',
          evolvesTo: [{
            id: 2,
            name: 'ivysaur',
            evolutionLevel: 16
          }]
        }
      });

      const result = await levelService.canEvolve('pokemon-1');

      expect(result.canEvolve).toBe(false);
      expect(result.requiredLevel).toBe(16);
      expect(result.currentLevel).toBe(10);
    });
  });
});
