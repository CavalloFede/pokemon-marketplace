import { Link } from 'react-router-dom';
import { useUser, useClaimDailyReward, usePokemon, usePokedexStats, useShopItems } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';

export default function Home() {
  const { user } = useAuthStore();
  const { data: userData } = useUser();
  const { data: pokemonData } = usePokemon({ limit: 100 });
  const { data: pokedexStats } = usePokedexStats();
  const { data: shopItems } = useShopItems();
  const claimReward = useClaimDailyReward();

  const canClaimDaily = userData?.canClaimDaily ?? false;
  const streak = userData?.streak ?? 0;
  const rewardAmount = getRewardAmount(streak);

  const totalPokemon = pokemonData?.total ?? 0;
  const shiniesCount = pokemonData?.pokemon?.filter((p: any) => p.isShiny).length ?? 0;
  const completionPercent = pokedexStats?.completionPercent ?? 0;

  function getRewardAmount(currentStreak: number): number {
    if (currentStreak >= 7) return 200;
    if (currentStreak >= 3) return 175;
    if (currentStreak >= 1) return 150;
    return 100;
  }

  const handleClaimDaily = async () => {
    try {
      await claimReward.mutateAsync();
    } catch (error) {
      console.error('Failed to claim daily reward:', error);
    }
  };

  const eggItems = shopItems?.filter((item: any) => item.itemType === 'egg') ?? [];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-12">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Welcome, <span className="text-pokemon-electric">{user?.displayName || 'Trainer'}</span>!
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Collect, trade, and show off your Pokemon collection!
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/shop" className="btn btn-primary text-lg px-8 py-3">
            Visit Shop
          </Link>
          <Link to="/collection" className="btn btn-secondary text-lg px-8 py-3">
            My Collection
          </Link>
        </div>
      </div>

      {/* Daily Reward Banner */}
      <div className={`card border ${canClaimDaily ? 'bg-gradient-to-r from-pokemon-electric/20 to-pokemon-fire/20 border-pokemon-electric/30' : 'bg-gray-800/50 border-gray-700'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">
              {canClaimDaily ? 'Daily Reward Available!' : 'Daily Reward Claimed'}
            </h2>
            <p className="text-gray-400">
              {canClaimDaily
                ? `Day ${streak + 1} streak bonus!`
                : `Come back tomorrow! Current streak: ${streak} days`
              }
            </p>
          </div>
          <button
            onClick={handleClaimDaily}
            disabled={!canClaimDaily || claimReward.isPending}
            className={`btn ${canClaimDaily ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
          >
            {claimReward.isPending ? (
              <span className="animate-spin">...</span>
            ) : (
              `Claim ${rewardAmount}`
            )} 🪙
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl mb-2">📦</div>
          <div className="text-2xl font-bold">{totalPokemon}</div>
          <div className="text-gray-400">Pokemon Owned</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">📱</div>
          <div className="text-2xl font-bold">{completionPercent.toFixed(1)}%</div>
          <div className="text-gray-400">Pokedex Complete</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">🔄</div>
          <div className="text-2xl font-bold">{userData?.tradesCompleted ?? 0}</div>
          <div className="text-gray-400">Trades Completed</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">✨</div>
          <div className="text-2xl font-bold">{shiniesCount}</div>
          <div className="text-gray-400">Shinies Found</div>
        </div>
      </div>

      {/* Featured in Shop */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Featured in Shop</h2>
          <Link to="/shop" className="text-pokemon-electric hover:underline">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {eggItems.length > 0 ? (
            eggItems.slice(0, 4).map((item: any) => (
              <Link
                key={item.id}
                to="/shop"
                className="card hover:ring-2 hover:ring-pokemon-electric transition-all cursor-pointer"
              >
                <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                  <span className="text-6xl">🥚</span>
                </div>
                <h3 className="font-bold">{item.name}</h3>
                <p className="text-pokemon-electric">{item.price} 🪙</p>
              </Link>
            ))
          ) : (
            ['Mystery Egg', 'Common Egg', 'Rare Egg', 'Legendary Egg'].map((item) => (
              <Link
                key={item}
                to="/shop"
                className="card hover:ring-2 hover:ring-pokemon-electric transition-all cursor-pointer"
              >
                <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                  <span className="text-6xl">🥚</span>
                </div>
                <h3 className="font-bold">{item}</h3>
                <p className="text-pokemon-electric">??? 🪙</p>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
