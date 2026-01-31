import { useState } from 'react';
import { usePokedex, usePokedexStats } from '../hooks/useApi';

// Pokemon generation ranges
const GENERATIONS = [
  { gen: 1, name: 'Kanto', start: 1, end: 151 },
  { gen: 2, name: 'Johto', start: 152, end: 251 },
  { gen: 3, name: 'Hoenn', start: 252, end: 386 },
  { gen: 4, name: 'Sinnoh', start: 387, end: 493 },
  { gen: 5, name: 'Unova', start: 494, end: 649 },
  { gen: 6, name: 'Kalos', start: 650, end: 721 },
  { gen: 7, name: 'Alola', start: 722, end: 809 },
  { gen: 8, name: 'Galar', start: 810, end: 905 },
  { gen: 9, name: 'Paldea', start: 906, end: 1025 },
];

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];

const RARITY_COLORS: Record<string, string> = {
  common: 'bg-gray-600',
  uncommon: 'bg-green-600',
  rare: 'bg-blue-600',
  epic: 'bg-purple-600',
  legendary: 'bg-yellow-600',
  mythical: 'bg-pink-600',
};

interface PokedexEntry {
  speciesId: number;
  species: {
    id: number;
    name: string;
    spriteUrl: string;
    rarity: string;
    types: string[];
  };
  firstObtainedAt: string;
  timesObtained: number;
  hasShiny: boolean;
}

export default function Pokedex() {
  const [selectedGen, setSelectedGen] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<PokedexEntry | null>(null);

  const { data: pokedexData, isLoading } = usePokedex({ generation: selectedGen });
  const { data: stats } = usePokedexStats();

  const currentGen = GENERATIONS.find((g) => g.gen === selectedGen)!;
  const entries = pokedexData?.entries ?? [];

  // Create a map for quick lookup
  const obtainedMap = new Map<number, PokedexEntry>();
  entries.forEach((entry: PokedexEntry) => {
    obtainedMap.set(entry.speciesId, entry);
  });

  // Generate all pokemon slots for the current generation
  const genSlots = [];
  for (let i = currentGen.start; i <= currentGen.end; i++) {
    genSlots.push({
      id: i,
      entry: obtainedMap.get(i) || null,
    });
  }

  const totalObtained = stats?.totalObtained ?? 0;
  const totalSpecies = stats?.totalSpecies ?? 1025;
  const completionPercent = stats?.completionPercent ?? 0;

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
        <h1 className="text-3xl font-bold">Pokedex</h1>
        <div className="text-gray-400">
          {totalObtained} / {totalSpecies} ({completionPercent.toFixed(1)}%)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card">
        <div className="flex justify-between text-sm mb-2">
          <span>Completion Progress</span>
          <span>{completionPercent.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pokemon-electric to-pokemon-fire transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>0</span>
          <span>{totalSpecies}</span>
        </div>
      </div>

      {/* Rarity Stats */}
      {stats?.byRarity && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {RARITY_ORDER.map((rarity) => {
            const data = stats.byRarity[rarity];
            if (!data) return null;
            return (
              <div key={rarity} className="card p-3 text-center">
                <div className={`w-3 h-3 rounded-full ${RARITY_COLORS[rarity]} mx-auto mb-1`} />
                <p className="text-xs capitalize">{rarity}</p>
                <p className="font-bold">{data.obtained}/{data.total}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Generation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {GENERATIONS.map((gen) => (
          <button
            key={gen.gen}
            onClick={() => setSelectedGen(gen.gen)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              gen.gen === selectedGen
                ? 'bg-pokemon-electric text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Gen {gen.gen}
            <span className="text-xs ml-1 opacity-70">({gen.name})</span>
          </button>
        ))}
      </div>

      {/* Pokemon Grid */}
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
        {genSlots.map((slot) => {
          const isObtained = slot.entry !== null;
          const entry = slot.entry;

          return (
            <div
              key={slot.id}
              onClick={() => entry && setSelectedEntry(entry)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all ${
                isObtained
                  ? 'bg-gray-700 cursor-pointer hover:ring-2 hover:ring-pokemon-electric'
                  : 'bg-gray-800/50'
              }`}
            >
              {isObtained && entry ? (
                <>
                  {entry.species.spriteUrl ? (
                    <img
                      src={entry.species.spriteUrl}
                      alt={entry.species.name}
                      className="w-10 h-10 pixelated"
                    />
                  ) : (
                    <span className="text-xl">?</span>
                  )}
                  {entry.hasShiny && (
                    <span className="absolute top-0 right-0 text-xs">✨</span>
                  )}
                </>
              ) : (
                <span className="text-gray-600 text-xs">#{slot.id}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="card max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-gray-400">#{selectedEntry.speciesId}</span>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 hover:text-white"
              >
                X
              </button>
            </div>

            <div className="bg-gray-700 rounded-lg p-6 mb-4">
              {selectedEntry.species.spriteUrl ? (
                <img
                  src={selectedEntry.species.spriteUrl}
                  alt={selectedEntry.species.name}
                  className="w-24 h-24 mx-auto pixelated"
                />
              ) : (
                <span className="text-6xl">?</span>
              )}
            </div>

            <h2 className="text-xl font-bold capitalize mb-2">
              {selectedEntry.species.name}
            </h2>

            <div className="flex justify-center gap-2 mb-4">
              {selectedEntry.species.types?.map((type) => (
                <span
                  key={type}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm capitalize"
                >
                  {type}
                </span>
              ))}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Rarity</span>
                <span className="capitalize">{selectedEntry.species.rarity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Times Obtained</span>
                <span>{selectedEntry.timesObtained}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">First Obtained</span>
                <span>{new Date(selectedEntry.firstObtainedAt).toLocaleDateString()}</span>
              </div>
              {selectedEntry.hasShiny && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Shiny Found</span>
                  <span className="text-yellow-400">Yes ✨</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedEntry(null)}
              className="btn btn-primary w-full mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
