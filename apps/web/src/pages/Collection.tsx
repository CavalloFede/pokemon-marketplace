export default function Collection() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Collection</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search..."
            className="input"
          />
          <select className="input">
            <option>All Rarity</option>
            <option>Common</option>
            <option>Uncommon</option>
            <option>Rare</option>
            <option>Epic</option>
            <option>Legendary</option>
            <option>Mythical</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      <div className="card text-center py-16">
        <div className="text-6xl mb-4">📦</div>
        <h2 className="text-2xl font-bold mb-2">No Pokemon Yet</h2>
        <p className="text-gray-400 mb-4">
          Visit the shop to get your first Pokemon!
        </p>
        <a href="/shop" className="btn btn-primary">
          Go to Shop
        </a>
      </div>
    </div>
  );
}
