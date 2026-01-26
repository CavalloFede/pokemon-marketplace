import { cache, CACHE_TTL } from '../lib/redis.js';
import type { PokeAPIPokemon, PokeAPISpecies } from '@pokemon-marketplace/shared';

const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';

interface PokemonListResponse {
  count: number;
  results: Array<{ name: string; url: string }>;
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
