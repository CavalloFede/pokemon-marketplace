import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';

// Query keys
export const queryKeys = {
  user: ['user'] as const,
  pokemon: ['pokemon'] as const,
  team: ['team'] as const,
  pokedex: ['pokedex'] as const,
  pokedexStats: ['pokedex', 'stats'] as const,
  shopItems: ['shop', 'items'] as const,
  trades: ['trades'] as const,
  trade: (id: string) => ['trades', id] as const,
  evolutionReady: ['evolution', 'ready'] as const,
};

// User hooks
export function useUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => api.getCurrentUser(),
  });
}

export function useClaimDailyReward() {
  const queryClient = useQueryClient();
  const setCoins = useAuthStore((state) => state.setCoins);

  return useMutation({
    mutationFn: () => api.claimDailyReward(),
    onSuccess: (data) => {
      setCoins(data.newBalance);
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

// Pokemon hooks
export function usePokemon(params?: {
  rarity?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...queryKeys.pokemon, params],
    queryFn: async () => {
      const result = await api.getMyPokemon({
        rarity: params?.rarity,
        search: params?.search,
        page: params?.page,
        pageSize: params?.limit,
      });
      return {
        pokemon: result.data,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      };
    },
  });
}

export function useTeam() {
  return useQuery({
    queryKey: queryKeys.team,
    queryFn: async () => {
      const result = await api.getMyTeam();
      return result.team;
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pokemonIds: string[]) => api.updateTeam(pokemonIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team });
      queryClient.invalidateQueries({ queryKey: queryKeys.pokemon });
    },
  });
}

// Pokedex hooks
export function usePokedex(params?: { generation?: number }) {
  return useQuery({
    queryKey: [...queryKeys.pokedex, params],
    queryFn: async () => {
      const result = await api.getPokedex({ generation: params?.generation });
      return {
        entries: result.data.filter((e) => e.obtained).map((e) => ({
          speciesId: e.species.id,
          species: e.species,
          firstObtainedAt: new Date().toISOString(), // API doesn't return this yet
          timesObtained: e.timesObtained,
          hasShiny: false, // API doesn't return this yet
        })),
        total: result.total,
      };
    },
  });
}

export function usePokedexStats() {
  return useQuery({
    queryKey: queryKeys.pokedexStats,
    queryFn: async () => {
      const result = await api.getPokedexStats();
      return {
        totalObtained: result.obtained,
        totalSpecies: result.totalSpecies,
        completionPercent: result.percentage,
        byRarity: result.byRarity,
        byGeneration: result.byGeneration,
      };
    },
  });
}

// Shop hooks
export function useShopItems() {
  return useQuery({
    queryKey: queryKeys.shopItems,
    queryFn: () => api.getShopItems(),
  });
}

export function usePurchase() {
  const queryClient = useQueryClient();
  const setCoins = useAuthStore((state) => state.setCoins);

  return useMutation({
    mutationFn: ({ itemId }: { itemId: string; quantity?: number }) =>
      api.purchaseItem(itemId),
    onSuccess: (data) => {
      setCoins(data.newBalance);
      queryClient.invalidateQueries({ queryKey: queryKeys.pokemon });
      queryClient.invalidateQueries({ queryKey: queryKeys.pokedex });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopItems });
    },
  });
}

// Trade hooks
export function useTrades(params?: { status?: string }) {
  return useQuery({
    queryKey: [...queryKeys.trades, params],
    queryFn: async () => {
      const result = await api.getTrades(params);
      return result.data;
    },
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      receiverId: string;
      offeredPokemonIds: string[];
      requestedPokemonIds: string[];
      coinsOffered?: number;
    }) =>
      api.createTrade({
        receiverId: data.receiverId,
        initiatorPokemonIds: data.offeredPokemonIds,
        receiverPokemonIds: data.requestedPokemonIds,
        coinsOffered: data.coinsOffered,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trades });
    },
  });
}

export function useAcceptTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tradeId: string) => api.acceptTrade(tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trades });
      queryClient.invalidateQueries({ queryKey: queryKeys.pokemon });
      queryClient.invalidateQueries({ queryKey: queryKeys.pokedex });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

export function useRejectTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tradeId: string) => api.rejectTrade(tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trades });
    },
  });
}

// Evolution hooks
export function useEvolutionReady() {
  return useQuery({
    queryKey: queryKeys.evolutionReady,
    queryFn: async () => {
      const result = await api.getEvolutionReady();
      return result.pokemon;
    },
  });
}

export function useEvolvePokemon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pokemonId: string) => api.evolvePokemon(pokemonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pokemon });
      queryClient.invalidateQueries({ queryKey: queryKeys.evolutionReady });
      queryClient.invalidateQueries({ queryKey: queryKeys.pokedex });
      queryClient.invalidateQueries({ queryKey: queryKeys.pokedexStats });
    },
  });
}

export function useSuppressEvolution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pokemonId: string) => api.suppressEvolutionNotification(pokemonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.evolutionReady });
    },
  });
}
