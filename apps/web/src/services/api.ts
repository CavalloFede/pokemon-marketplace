import { getIdToken } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiError {
  error: string;
}

class ApiClient {
  private onUnauthorized: (() => void) | null = null;

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    idToken?: string
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true', // Skip ngrok interstitial page
      ...options.headers
    };

    // Get Firebase ID token for authenticated requests
    const token = idToken || await getIdToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle 401 - unauthorized
    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid response from server');
    }

    return response.json();
  }

  // Auth
  async authenticate(idToken: string) {
    return this.request<{
      success: boolean;
      user: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        coins: number;
      };
    }>('/auth/authenticate', {
      method: 'POST',
      body: JSON.stringify({ idToken })
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors
    }
  }

  // Users
  async getCurrentUser(idToken?: string) {
    return this.request<{
      id: string;
      email: string;
      displayName: string;
      avatarUrl: string | null;
      coins: number;
      streakDays: number;
      pokemon: Array<{ id: string; species: { name: string; spriteUrl: string } }>;
      stats: {
        pokemonOwned: number;
        pokedexEntries: number;
        pokedexPercentage: number;
        tradesCompleted: number;
        shiniesFound: number;
      };
      dailyReward: {
        canClaim: boolean;
        nextClaimAt: string | null;
        currentStreak: number;
        potentialReward: number;
      };
    }>('/users/me', {}, idToken);
  }

  async claimDailyReward() {
    return this.request<{
      success: boolean;
      coinsAwarded: number;
      newBalance: number;
      streakDay: number;
      nextClaimAt: string;
    }>('/users/me/daily-reward', { method: 'POST', body: JSON.stringify({}) });
  }

  // Shop
  async getShopItems() {
    return this.request<Array<{
      id: string;
      itemType: 'pokemon' | 'egg';
      speciesId: number | null;
      species: { name: string; spriteUrl: string; rarity: string } | null;
      eggCategory: string | null;
      price: number;
    }>>('/shop/items');
  }

  async purchaseItem(itemId: string) {
    return this.request<{
      success: boolean;
      pokemon: {
        id: string;
        speciesId: number;
        species: { name: string; spriteUrl: string; spriteShinyUrl: string; rarity: string };
        isShiny: boolean;
      };
      newBalance: number;
      isNewPokedexEntry: boolean;
      rolledRarity: string | null;
    }>('/shop/purchase', {
      method: 'POST',
      body: JSON.stringify({ itemId })
    });
  }

  // Pokemon
  async getMyPokemon(params?: {
    page?: number;
    pageSize?: number;
    rarity?: string;
    types?: string;
    search?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    if (params?.rarity) searchParams.set('rarity', params.rarity);
    if (params?.types) searchParams.set('types', params.types);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        speciesId: number;
        species: {
          id: number;
          name: string;
          spriteUrl: string;
          spriteShinyUrl: string;
          types: string[];
          rarity: string;
        };
        nickname: string | null;
        isShiny: boolean;
        isInTeam: boolean;
        teamPosition: number | null;
        isFavorite: boolean;
        level: number;
        experience: number;
        levelInfo?: {
          level: number;
          experience: number;
          expToNextLevel: number;
          expProgress: number;
          isMaxLevel: boolean;
        };
      }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/pokemon${query ? `?${query}` : ''}`);
  }

  async getMyTeam() {
    return this.request<{
      team: Array<{
        id: string;
        species: { name: string; spriteUrl: string; spriteShinyUrl: string };
        nickname: string | null;
        isShiny: boolean;
        teamPosition: number;
      }>;
    }>('/pokemon/team');
  }

  async updateTeam(pokemonIds: string[]) {
    return this.request<{ team: Array<unknown> }>('/pokemon/team', {
      method: 'PUT',
      body: JSON.stringify({ pokemonIds })
    });
  }

  // Pokedex
  async getPokedex(params?: { generation?: number; page?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.generation) searchParams.set('generation', params.generation.toString());
    if (params?.page) searchParams.set('page', params.page.toString());

    const query = searchParams.toString();
    return this.request<{
      data: Array<{
        species: {
          id: number;
          name: string;
          spriteUrl: string;
          types: string[];
          rarity: string;
        };
        obtained: boolean;
        timesObtained: number;
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>(`/pokedex${query ? `?${query}` : ''}`);
  }

  async getPokedexStats() {
    return this.request<{
      totalSpecies: number;
      obtained: number;
      percentage: number;
      byGeneration: Record<number, { total: number; obtained: number }>;
      byRarity: Record<string, { total: number; obtained: number }>;
    }>('/pokedex/stats');
  }

  // Trades
  async getTrades(params?: { status?: string; role?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.role) searchParams.set('role', params.role);

    const query = searchParams.toString();
    return this.request<{
      data: Array<{
        id: string;
        initiator: { id: string; displayName: string };
        receiver: { id: string; displayName: string };
        status: string;
        initiatorPokemon: Array<{ species: { name: string; spriteUrl: string } }>;
        receiverPokemon: Array<{ species: { name: string; spriteUrl: string } }>;
        coinsOffered: number;
        createdAt: string;
        expiresAt: string;
      }>;
      total: number;
    }>(`/trades${query ? `?${query}` : ''}`);
  }

  async createTrade(data: {
    receiverId: string;
    initiatorPokemonIds: string[];
    receiverPokemonIds: string[];
    coinsOffered?: number;
    message?: string;
  }) {
    return this.request<{ success: boolean; trade: unknown }>('/trades', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async acceptTrade(tradeId: string) {
    return this.request<{ success: boolean }>(`/trades/${tradeId}/accept`, {
      method: 'POST'
    });
  }

  async rejectTrade(tradeId: string) {
    return this.request<{ success: boolean }>(`/trades/${tradeId}/reject`, {
      method: 'POST'
    });
  }

  async cancelTrade(tradeId: string) {
    return this.request<{ success: boolean }>(`/trades/${tradeId}/cancel`, {
      method: 'POST'
    });
  }

  // Evolution
  async getEvolutionReady() {
    return this.request<{
      pokemon: Array<{
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
      }>;
    }>('/pokemon/evolution-ready');
  }

  async evolvePokemon(pokemonId: string) {
    return this.request<{
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
    }>(`/pokemon/${pokemonId}/evolve`, {
      method: 'POST'
    });
  }

  async suppressEvolutionNotification(pokemonId: string) {
    return this.request<{ success: boolean }>(`/pokemon/${pokemonId}/evolution-settings`, {
      method: 'PATCH',
      body: JSON.stringify({ suppressNotification: true })
    });
  }
}

export const api = new ApiClient();
