import { cache, CACHE_TTL } from '../lib/redis.js';
import type { PokeAPIPokemon, PokeAPISpecies } from '@pokemon-marketplace/shared';

const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';

interface PokemonListResponse {
  count: number;
  results: Array<{ name: string; url: string }>;
}

interface EvolutionChainLink {
  species: { name: string; url: string };
  evolution_details: Array<{
    min_level: number | null;
    trigger: { name: string };
    item: { name: string } | null;
  }>;
  evolves_to: EvolutionChainLink[];
}

interface EvolutionChainResponse {
  id: number;
  chain: EvolutionChainLink;
}

/**
 * Service for interacting with PokeAPI
 * Implements cache-aside pattern with Redis
 */
export class PokeApiService {
  /**
   * Fetch with caching
   */
  private async fetchWithCache<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttl: number = CACHE_TTL.POKEMON_SPECIES
  ): Promise<T> {
    // Try cache first
    const cached = await cache.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const data = await fetcher();

    // Store in cache
    await cache.set(cacheKey, data, ttl);

    return data;
  }

  /**
   * Get list of all Pokemon (names and URLs)
   */
  async getAllPokemonList(): Promise<Array<{ name: string; url: string; id: number }>> {
    const cacheKey = 'pokeapi:pokemon:list';

    return this.fetchWithCache(cacheKey, async () => {
      const response = await fetch(`${POKEAPI_BASE_URL}/pokemon?limit=1025`);
      if (!response.ok) {
        throw new Error(`PokeAPI error: ${response.status}`);
      }

      const data: PokemonListResponse = await response.json();

      return data.results.map((p, index) => ({
        name: p.name,
        url: p.url,
        id: index + 1
      }));
    }, CACHE_TTL.POKEMON_LIST);
  }

  /**
   * Get detailed Pokemon data by ID
   */
  async getPokemonById(id: number): Promise<PokeAPIPokemon> {
    const cacheKey = `pokeapi:pokemon:${id}`;

    return this.fetchWithCache(cacheKey, async () => {
      const response = await fetch(`${POKEAPI_BASE_URL}/pokemon/${id}`);
      if (!response.ok) {
        throw new Error(`PokeAPI error: ${response.status}`);
      }

      return response.json();
    });
  }

  /**
   * Get Pokemon species data (for rarity calculation)
   */
  async getSpeciesById(id: number): Promise<PokeAPISpecies> {
    const cacheKey = `pokeapi:species:${id}`;

    return this.fetchWithCache(cacheKey, async () => {
      const response = await fetch(`${POKEAPI_BASE_URL}/pokemon-species/${id}`);
      if (!response.ok) {
        throw new Error(`PokeAPI error: ${response.status}`);
      }

      return response.json();
    });
  }

  /**
   * Get complete Pokemon data (pokemon + species)
   */
  async getCompletePokemonData(id: number): Promise<{
    pokemon: PokeAPIPokemon;
    species: PokeAPISpecies;
  }> {
    const [pokemon, species] = await Promise.all([
      this.getPokemonById(id),
      this.getSpeciesById(id)
    ]);

    return { pokemon, species };
  }

  /**
   * Get evolution chain by ID
   */
  async getEvolutionChain(chainId: number): Promise<EvolutionChainResponse> {
    const cacheKey = `pokeapi:evolution-chain:${chainId}`;

    return this.fetchWithCache(cacheKey, async () => {
      const response = await fetch(`${POKEAPI_BASE_URL}/evolution-chain/${chainId}`);
      if (!response.ok) {
        throw new Error(`PokeAPI error: ${response.status}`);
      }

      return response.json();
    });
  }

  /**
   * Parse evolution data from species to get evolution requirements
   * Returns: { evolvesFromId, evolutionLevel } or null if base form
   */
  async getEvolutionData(speciesId: number): Promise<{
    evolvesFromId: number | null;
    evolutionLevel: number | null;
  }> {
    const species = await this.getSpeciesById(speciesId);

    // If no evolves_from_species, this is a base form
    if (!species.evolves_from_species) {
      return { evolvesFromId: null, evolutionLevel: null };
    }

    const evolvesFromId = this.extractIdFromUrl(species.evolves_from_species.url);

    // Get evolution chain to find the level requirement
    const chainId = this.extractIdFromUrl(species.evolution_chain.url);
    const evolutionChain = await this.getEvolutionChain(chainId);

    // Find this species in the chain to get evolution details
    const evolutionLevel = this.findEvolutionLevel(evolutionChain.chain, speciesId);

    return { evolvesFromId, evolutionLevel };
  }

  /**
   * Extract ID from PokeAPI URL
   */
  private extractIdFromUrl(url: string): number {
    const matches = url.match(/\/(\d+)\/?$/);
    return matches ? parseInt(matches[1], 10) : 0;
  }

  /**
   * Recursively search evolution chain for a species and return its min_level
   */
  private findEvolutionLevel(chain: EvolutionChainLink, targetSpeciesId: number): number | null {
    // Check if current chain link is the target
    const currentId = this.extractIdFromUrl(chain.species.url);
    if (currentId === targetSpeciesId) {
      // Get min_level from evolution_details
      if (chain.evolution_details && chain.evolution_details.length > 0) {
        return chain.evolution_details[0].min_level || null;
      }
      return null;
    }

    // Search in evolves_to
    for (const nextEvolution of chain.evolves_to) {
      const result = this.findEvolutionLevel(nextEvolution, targetSpeciesId);
      if (result !== null) {
        return result;
      }
      // If we found the species but no level, check this branch
      const nextId = this.extractIdFromUrl(nextEvolution.species.url);
      if (nextId === targetSpeciesId) {
        if (nextEvolution.evolution_details && nextEvolution.evolution_details.length > 0) {
          return nextEvolution.evolution_details[0].min_level || null;
        }
      }
    }

    return null;
  }

  /**
   * Fetch multiple Pokemon in parallel with rate limiting
   */
  async getManyPokemon(
    ids: number[],
    concurrency: number = 10,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Array<{ pokemon: PokeAPIPokemon; species: PokeAPISpecies }>> {
    const results: Array<{ pokemon: PokeAPIPokemon; species: PokeAPISpecies }> = [];
    let completed = 0;

    // Process in batches
    for (let i = 0; i < ids.length; i += concurrency) {
      const batch = ids.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(id => this.getCompletePokemonData(id))
      );

      results.push(...batchResults);
      completed += batch.length;

      if (onProgress) {
        onProgress(completed, ids.length);
      }

      // Small delay between batches to be nice to the API
      if (i + concurrency < ids.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}

export const pokeApiService = new PokeApiService();
