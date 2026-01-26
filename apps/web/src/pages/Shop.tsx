export default function Shop() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Shop</h1>

      {/* Eggs Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Eggs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Common Egg', price: 75, pool: 'Common + Uncommon' },
            { name: 'Rare Egg', price: 350, pool: 'Rare + Epic' },
            { name: 'Legendary Egg', price: 2500, pool: 'Legendary + Mythical' },
            { name: 'Mystery Egg', price: 500, pool: 'All Pokemon!' },
          ].map((egg) => (
            <div
              key={egg.name}
              className="card hover:ring-2 hover:ring-pokemon-electric transition-all cursor-pointer"
            >
              <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-6xl animate-wiggle">🥚</span>
              </div>
              <h3 className="font-bold">{egg.name}</h3>
              <p className="text-sm text-gray-400 mb-2">{egg.pool}</p>
              <button className="w-full btn btn-primary">
                Buy {egg.price} 🪙
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Pokemon */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Featured Pokemon</h2>
        <p className="text-gray-400">Coming soon...</p>
      </section>
    </div>
  );
}
