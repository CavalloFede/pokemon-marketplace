import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionService } from './evolution.service.js';
import { PokemonRarity } from '@pokemon-marketplace/shared';

// Mock LevelService
vi.mock('./level.service.js', () => ({
  levelService: {
    calculateLevelInfo: vi.fn((level, exp, lastGain) => ({
      level,
      experience: exp,
      expToNextLevel: 100,
      expForCurrentLevel: exp,
      expProgress: 50,
      isMaxLevel: level >= 100
    }))
  }
}));

// Mock MetricsService
vi.mock('./metrics.service.js', () => ({
  metricsService: {
    trackPokemonObtained: vi.fn()
  }
}));

// Mock Prisma
const mockPrisma = {
  userPokemon: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
  },
  userPokedex: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  $transaction: vi.fn((fn) => fn(mockPrisma))
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma
}));

describe('EvolutionService', () => {
  let evolutionService: EvolutionService;

  const mockBulbasaur = {
    id: 'pokemon-1',
    userId: 'user-1',
    speciesId: 1,
    nickname: null,
    isShiny: false,
    level: 20,
    experience: 4000,
    lastExperienceGainAt: new Date(),
    suppressEvolutionNotification: false,
    species: {
      id: 1,
      name: 'bulbasaur',
      spriteUrl: 'bulbasaur.png',
      spriteShinyUrl: 'bulbasaur-shiny.png',
      rarity: PokemonRarity.COMMON,
      evolvesTo: [{
        id: 2,
        name: 'ivysaur',
        spriteUrl: 'ivysaur.png',
        spriteShinyUrl: 'ivysaur-shiny.png',
        evolutionLevel: 16,
        rarity: PokemonRarity.UNCOMMON
      }]
    }
  };

  const mockShinyBulbasaur = {
    ...mockBulbasaur,
    id: 'pokemon-shiny',
    isShiny: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    evolutionService = new EvolutionService();
  });

  describe('getEvolutionReadyPokemon', () => {
    it('should return empty array if no Pokemon ready', async () => {
      mockPrisma.userPokemon.findMany.mockResolvedValue([]);

      const result = await evolutionService.getEvolutionReadyPokemon('user-1');

      expect(result).toEqual([]);
    });

    it('should return Pokemon that meet evolution level', async () => {
      mockPrisma.userPokemon.findMany.mockResolvedValue([mockBulbasaur]);

      const result = await evolutionService.getEvolutionReadyPokemon('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pokemon-1');
      expect(result[0].targetSpecies.name).toBe('ivysaur');
    });

    it('should exclude Pokemon with suppressed notifications', async () => {
      mockPrisma.userPokemon.findMany.mockResolvedValue([]);

      await evolutionService.getEvolutionReadyPokemon('user-1');

      expect(mockPrisma.userPokemon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            suppressEvolutionNotification: false
          }
        })
      );
    });

    it('should exclude Pokemon without evolution target', async () => {
      const venusaur = {
        ...mockBulbasaur,
        species: {
          ...mockBulbasaur.species,
          evolvesTo: [] // No evolution
        }
      };
      mockPrisma.userPokemon.findMany.mockResolvedValue([venusaur]);

      const result = await evolutionService.getEvolutionReadyPokemon('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('evolvePokemon', () => {
    it('should throw error if Pokemon not found', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(null);

      await expect(evolutionService.evolvePokemon('user-1', 'invalid-id'))
        .rejects.toThrow('Pokemon not found');
    });

    it('should throw error if Pokemon cannot evolve', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue({
        ...mockBulbasaur,
        species: {
          ...mockBulbasaur.species,
          evolvesTo: []
        }
      });

      await expect(evolutionService.evolvePokemon('user-1', 'pokemon-1'))
        .rejects.toThrow('This Pokemon cannot evolve');
    });

    it('should throw error if level is insufficient', async () => {
      const lowLevelBulbasaur = {
        ...mockBulbasaur,
        level: 10
      };
      mockPrisma.userPokemon.findFirst.mockResolvedValue(lowLevelBulbasaur);

      // Mock levelService to return level 10
      const { levelService } = await import('./level.service.js');
      (levelService.calculateLevelInfo as any).mockReturnValue({
        level: 10,
        experience: 1000,
        expToNextLevel: 100,
        expForCurrentLevel: 1000,
        expProgress: 50,
        isMaxLevel: false
      });

      await expect(evolutionService.evolvePokemon('user-1', 'pokemon-1'))
        .rejects.toThrow('Level 16 required to evolve');
    });

    it('should successfully evolve Pokemon', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockBulbasaur);
      mockPrisma.userPokemon.update.mockResolvedValue({
        ...mockBulbasaur,
        speciesId: 2,
        species: mockBulbasaur.species.evolvesTo[0]
      });
      mockPrisma.userPokedex.findUnique.mockResolvedValue(null);
      mockPrisma.userPokedex.create.mockResolvedValue({});
      mockPrisma.userPokemon.count.mockResolvedValue(0);
      mockPrisma.userPokedex.update.mockResolvedValue({});

      const result = await evolutionService.evolvePokemon('user-1', 'pokemon-1');

      expect(result.success).toBe(true);
      expect(result.pokemon.previousSpeciesName).toBe('bulbasaur');
      expect(result.pokemon.newSpeciesName).toBe('ivysaur');
      expect(result.isNewPokedexEntry).toBe(true);
    });

    it('should maintain shiny status after evolution', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockShinyBulbasaur);
      mockPrisma.userPokemon.update.mockResolvedValue({
        ...mockShinyBulbasaur,
        speciesId: 2,
        isShiny: true, // Still shiny!
        species: mockBulbasaur.species.evolvesTo[0]
      });
      mockPrisma.userPokedex.findUnique.mockResolvedValue(null);
      mockPrisma.userPokedex.create.mockResolvedValue({});
      mockPrisma.userPokemon.count.mockResolvedValue(0);
      mockPrisma.userPokedex.update.mockResolvedValue({});

      const result = await evolutionService.evolvePokemon('user-1', 'pokemon-shiny');

      expect(result.success).toBe(true);
      expect(result.pokemon.isShiny).toBe(true); // Shiny status preserved!
    });

    it('should update Pokedex for new species', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockBulbasaur);
      mockPrisma.userPokemon.update.mockResolvedValue({
        ...mockBulbasaur,
        speciesId: 2,
        species: mockBulbasaur.species.evolvesTo[0]
      });
      mockPrisma.userPokedex.findUnique.mockResolvedValue(null);
      mockPrisma.userPokemon.count.mockResolvedValue(0);

      await evolutionService.evolvePokemon('user-1', 'pokemon-1');

      expect(mockPrisma.userPokedex.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          speciesId: 2,
          hasCurrently: true
        }
      });
    });

    it('should update hasCurrently to false for previous species when last one evolves', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockBulbasaur);
      mockPrisma.userPokemon.update.mockResolvedValue({
        ...mockBulbasaur,
        speciesId: 2,
        species: mockBulbasaur.species.evolvesTo[0]
      });
      mockPrisma.userPokedex.findUnique.mockResolvedValue(null);
      mockPrisma.userPokedex.create.mockResolvedValue({});
      mockPrisma.userPokemon.count.mockResolvedValue(0); // No more Bulbasaur

      await evolutionService.evolvePokemon('user-1', 'pokemon-1');

      expect(mockPrisma.userPokedex.update).toHaveBeenCalledWith({
        where: {
          userId_speciesId: {
            userId: 'user-1',
            speciesId: 1 // Bulbasaur
          }
        },
        data: {
          hasCurrently: false
        }
      });
    });
  });

  describe('updateEvolutionSettings', () => {
    it('should throw error if Pokemon not found', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(null);

      await expect(evolutionService.updateEvolutionSettings('user-1', 'invalid-id', true))
        .rejects.toThrow('Pokemon not found');
    });

    it('should update suppression setting', async () => {
      mockPrisma.userPokemon.findFirst.mockResolvedValue(mockBulbasaur);
      mockPrisma.userPokemon.update.mockResolvedValue({});

      await evolutionService.updateEvolutionSettings('user-1', 'pokemon-1', true);

      expect(mockPrisma.userPokemon.update).toHaveBeenCalledWith({
        where: { id: 'pokemon-1' },
        data: { suppressEvolutionNotification: true }
      });
    });
  });
});
