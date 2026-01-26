export default function Pokedex() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pokedex</h1>
        <div className="text-gray-400">
          0 / 1025 (0%)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card">
        <div className="flex justify-between text-sm mb-2">
          <span>Completion Progress</span>
          <span>0%</span>
        </div>
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pokemon-electric to-pokemon-fire transition-all"
            style={{ width: '0%' }}
          />
        </div>
      </div>

      {/* Generation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((gen) => (
          <button
            key={gen}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              gen === 1
                ? 'bg-pokemon-electric text-gray-900'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            Gen {gen}
          </button>
        ))}
      </div>

      {/* Pokemon Grid Placeholder */}
      <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center text-gray-600"
          >
            ?
          </div>
        ))}
      </div>
    </div>
  );
}
