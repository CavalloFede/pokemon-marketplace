import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-12">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Welcome to <span className="text-pokemon-electric">Pokemon Marketplace</span>
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
      <div className="card bg-gradient-to-r from-pokemon-electric/20 to-pokemon-fire/20 border border-pokemon-electric/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">Daily Reward Available!</h2>
            <p className="text-gray-400">Claim your free coins. Day 1 streak!</p>
          </div>
          <button className="btn btn-primary">
            Claim 100 🪙
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl mb-2">📦</div>
          <div className="text-2xl font-bold">0</div>
          <div className="text-gray-400">Pokemon Owned</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">📱</div>
          <div className="text-2xl font-bold">0%</div>
          <div className="text-gray-400">Pokedex Complete</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">🔄</div>
          <div className="text-2xl font-bold">0</div>
          <div className="text-gray-400">Trades Completed</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">✨</div>
          <div className="text-2xl font-bold">0</div>
          <div className="text-gray-400">Shinies Found</div>
        </div>
      </div>

      {/* Featured in Shop */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Featured in Shop</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Mystery Egg', 'Common Egg', 'Rare Egg', 'Legendary Egg'].map((item) => (
            <div key={item} className="card hover:ring-2 hover:ring-pokemon-electric transition-all cursor-pointer">
              <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-6xl">🥚</span>
              </div>
              <h3 className="font-bold">{item}</h3>
              <p className="text-pokemon-electric">500 🪙</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
