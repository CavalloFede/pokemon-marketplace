const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiError {
  error: string;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    // Load tokens from localStorage on init
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle 401 - try to refresh token
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        // Retry the request with new token
        (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(url, { ...options, headers });
        if (retryResponse.ok) {
          return retryResponse.json();
        }
      }
      // Refresh failed, clear tokens and notify
      this.clearTokens();
      this.onUnauthorized?.();
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private async tryRefreshToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.tokens.accessToken;
      localStorage.setItem('accessToken', data.tokens.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  // Auth
  async getLoginUrl(redirectUri: string) {
    return this.request<{ loginUrl: string }>(
      `/auth/login-url?redirectUri=${encodeURIComponent(redirectUri)}`
    );
  }

  async handleOAuthCallback(code: string, redirectUri: string) {
    return this.request<{
      success: boolean;
      user: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        coins: number;
      };
      tokens: {
        accessToken: string;
        idToken: string;
        refreshToken: string;
        expiresIn: number;
      };
    }>('/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code, redirectUri })
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
    }
  }

  // Users
  async getCurrentUser() {
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
    }>('/users/me');
  }

  async claimDailyReward() {
    return this.request<{
      success: boolean;
      coinsAwarded: number;
      newBalance: number;
      streakDay: number;
      nextClaimAt: string;
    }>('/users/me/daily-reward', { method: 'POST' });
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
        species: { name: string; spriteUrl: string; rarity: string };
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
        species: { name: string; spriteUrl: string };
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
}

export const api = new ApiClient();
