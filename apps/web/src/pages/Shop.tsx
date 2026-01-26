import { useState } from 'react';
import { useShopItems, usePurchase } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';

interface HatchResult {
  pokemon: {
    id: string;
    nickname: string | null;
    isShiny: boolean;
    species: {
      name: string;
      spriteUrl: string;
      rarity: string;
    };
  };
}

const EGG_DESCRIPTIONS: Record<string, string> = {
  mystery: 'Contains any Pokemon! Weighted by rarity.',
  common: 'Common and Uncommon Pokemon',
  rare: 'Rare and Epic Pokemon',
  legendary: 'Legendary and Mythical Pokemon',
};

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
  mythical: 'text-pink-400',
};

export default function Shop() {
  const { user } = useAuthStore();
  const { data: shopItems, isLoading } = useShopItems();
  const purchase = usePurchase();
  const [hatchResult, setHatchResult] = useState<HatchResult | null>(null);
  const [isHatching, setIsHatching] = useState(false);

  const eggItems = shopItems?.filter((item: any) => item.itemType === 'egg') ?? [];
  const pokemonItems = shopItems?.filter((item: any) => item.itemType === 'pokemon') ?? [];

  const handlePurchase = async (itemId: string) => {
    if (purchase.isPending) return;

    try {
      setIsHatching(true);
      const result = await purchase.mutateAsync({ itemId, quantity: 1 });

      // Show hatch animation for eggs
      if (result.pokemon) {
        setHatchResult({
          pokemon: {
            id: result.pokemon.id,
            nickname: null,
            isShiny: result.pokemon.isShiny,
            species: result.pokemon.species,
          },
        });
      }
    } catch (error: unknown) {
      console.error('Purchase failed:', error);
      alert(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setIsHatching(false);
    }
  };

  const closeHatchResult = () => {
    setHatchResult(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pokemon-electric"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Shop</h1>
        <div className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-full">
          <span className="text-pokemon-electric">🪙</span>
          <span className="font-bold">{user?.coins ?? 0}</span>
        </div>
      </div>

      {/* Eggs Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Eggs</h2>
        <p className="text-gray-400 mb-4">
          Buy eggs to hatch random Pokemon! Rarer eggs have better odds for rare Pokemon.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {eggItems.map((egg: any) => {
            const canAfford = (user?.coins ?? 0) >= egg.price;
            const eggType = egg.eggCategory || 'mystery';

            return (
              <div
                key={egg.id}
                className={`card transition-all ${canAfford ? 'hover:ring-2 hover:ring-pokemon-electric' : 'opacity-60'}`}
              >
                <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                  <span className={`text-6xl ${isHatching ? 'animate-bounce' : 'animate-wiggle'}`}>
                    🥚
                  </span>
                  {egg.stock !== null && egg.stock <= 5 && (
                    <span className="absolute top-2 right-2 bg-red-500 text-xs px-2 py-1 rounded">
                      {egg.stock} left!
                    </span>
                  )}
                </div>
                <h3 className="font-bold">{egg.name}</h3>
                <p className="text-sm text-gray-400 mb-2">
                  {EGG_DESCRIPTIONS[eggType] || 'Random Pokemon'}
                </p>
                <button
                  onClick={() => handlePurchase(egg.id)}
                  disabled={!canAfford || purchase.isPending}
                  className={`w-full btn ${canAfford ? 'btn-primary' : 'btn-secondary cursor-not-allowed'}`}
                >
                  {purchase.isPending ? '...' : `Buy ${egg.price} 🪙`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Featured Pokemon */}
      {pokemonItems.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Featured Pokemon</h2>
          <p className="text-gray-400 mb-4">
            Buy specific Pokemon directly! Limited stock available.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {pokemonItems.map((item: any) => {
              const canAfford = (user?.coins ?? 0) >= item.price;
              const species = item.species;

              return (
                <div
                  key={item.id}
                  className={`card transition-all ${canAfford ? 'hover:ring-2 hover:ring-pokemon-electric' : 'opacity-60'}`}
                >
                  <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center relative">
                    {species?.spriteUrl ? (
                      <img
                        src={species.spriteUrl}
                        alt={species.name}
                        className="w-20 h-20 pixelated"
                      />
                    ) : (
                      <span className="text-4xl">?</span>
                    )}
                    {item.stock !== null && item.stock <= 3 && (
                      <span className="absolute top-2 right-2 bg-red-500 text-xs px-2 py-1 rounded">
                        {item.stock} left!
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold capitalize">{species?.name || 'Unknown'}</h3>
                  <p className={`text-sm ${RARITY_COLORS[species?.rarity || 'common']} capitalize`}>
                    {species?.rarity || 'Unknown'}
                  </p>
                  <button
                    onClick={() => handlePurchase(item.id)}
                    disabled={!canAfford || purchase.isPending || item.stock === 0}
                    className={`w-full btn mt-2 ${canAfford && item.stock > 0 ? 'btn-primary' : 'btn-secondary cursor-not-allowed'}`}
                  >
                    {item.stock === 0 ? 'Sold Out' : `${item.price} 🪙`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Hatch Result Modal */}
      {hatchResult && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={closeHatchResult}
        >
          <div
            className="card max-w-sm w-full text-center animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-4">Egg Hatched!</h2>
            <div className="bg-gray-700 rounded-lg p-6 mb-4">
              {hatchResult.pokemon.species.spriteUrl ? (
                <img
                  src={hatchResult.pokemon.isShiny
                    ? hatchResult.pokemon.species.spriteUrl.replace('/sprites/pokemon/', '/sprites/pokemon/shiny/')
                    : hatchResult.pokemon.species.spriteUrl
                  }
                  alt={hatchResult.pokemon.species.name}
                  className="w-32 h-32 mx-auto pixelated"
                />
              ) : (
                <span className="text-8xl">?</span>
              )}
              <h3 className="text-xl font-bold capitalize mt-2">
                {hatchResult.pokemon.isShiny && <span className="text-yellow-400">✨ </span>}
                {hatchResult.pokemon.species.name}
                {hatchResult.pokemon.isShiny && <span className="text-yellow-400"> ✨</span>}
              </h3>
              <p className={`${RARITY_COLORS[hatchResult.pokemon.species.rarity]} capitalize`}>
                {hatchResult.pokemon.species.rarity}
              </p>
              {hatchResult.pokemon.isShiny && (
                <p className="text-yellow-400 text-sm mt-2">SHINY! Super rare!</p>
              )}
            </div>
            <button onClick={closeHatchResult} className="btn btn-primary w-full">
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
