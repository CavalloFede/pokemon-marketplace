import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import type {
  UserPokemon,
  ShopItem,
  Trade,
  PokedexEntry,
} from '@pokemon-marketplace/shared';

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
};

// User hooks
export function useUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => api.users.getMe(),
  });
}

export function useClaimDailyReward() {
  const queryClient = useQueryClient();
  const setCoins = useAuthStore((state) => state.setCoins);

  return useMutation({
    mutationFn: () => api.users.claimDailyReward(),
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
    queryFn: () => api.pokemon.getAll(params),
  });
}

export function useTeam() {
  return useQuery({
    queryKey: queryKeys.team,
    queryFn: () => api.pokemon.getTeam(),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pokemonIds: string[]) => api.pokemon.updateTeam(pokemonIds),
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
    queryFn: () => api.pokedex.getAll(params),
  });
}

export function usePokedexStats() {
  return useQuery({
    queryKey: queryKeys.pokedexStats,
    queryFn: () => api.pokedex.getStats(),
  });
}

// Shop hooks
export function useShopItems() {
  return useQuery({
    queryKey: queryKeys.shopItems,
    queryFn: () => api.shop.getItems(),
  });
}

export function usePurchase() {
  const queryClient = useQueryClient();
  const setCoins = useAuthStore((state) => state.setCoins);

  return useMutation({
    mutationFn: ({
      itemId,
      quantity = 1,
    }: {
      itemId: string;
      quantity?: number;
    }) => api.shop.purchase(itemId, quantity),
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
    queryFn: () => api.trades.getAll(params),
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
    }) => api.trades.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trades });
    },
  });
}

export function useAcceptTrade() {
  const queryClient = useQueryClient();
  const setCoins = useAuthStore((state) => state.setCoins);

  return useMutation({
    mutationFn: (tradeId: string) => api.trades.accept(tradeId),
    onSuccess: (data) => {
      if (data.newBalance !== undefined) {
        setCoins(data.newBalance);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.trades });
      queryClient.invalidateQueries({ queryKey: queryKeys.pokemon });
      queryClient.invalidateQueries({ queryKey: queryKeys.pokedex });
    },
  });
}

export function useRejectTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tradeId: string) => api.trades.reject(tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trades });
    },
  });
}
