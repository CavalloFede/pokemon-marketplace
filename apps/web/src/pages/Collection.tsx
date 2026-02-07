import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePokemon, useTeam, useUpdateTeam, useEvolutionReady, useSetNickname } from '../hooks/useApi';

const RARITY_OPTIONS = [
  { value: '', label: 'All Rarity' },
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'mythical', label: 'Mythical' },
];

const RARITY_COLORS: Record<string, string> = {
  common: 'border-gray-500',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-yellow-500',
  mythical: 'border-pink-500',
};

const RARITY_TEXT_COLORS: Record<string, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
  mythical: 'text-pink-400',
};

interface CollectionPokemon {
  id: string;
  speciesId: number;
  nickname: string | null;
  nicknameSetAt: string | null;
  isShiny: boolean;
  isInTeam: boolean;
  teamPosition: number | null;
  isFavorite: boolean;
  level: number;
  experience: number;
  levelInfo?: {
    level: number;
    experience: number;
    expToNextLevel: number;
    expProgress: number;
    isMaxLevel: boolean;
  };
  species: {
    id: number;
    name: string;
    spriteUrl: string;
    spriteShinyUrl: string;
    types: string[];
    rarity: string;
  };
}

interface TeamPokemon {
  id: string;
  nickname: string | null;
  isShiny: boolean;
  teamPosition: number;
  species: {
    name: string;
    spriteUrl: string;
  };
}

export default function Collection() {
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('');
  const [selectedPokemon, setSelectedPokemon] = useState<CollectionPokemon | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState('');

  const { data: pokemonData, isLoading } = usePokemon({
    rarity: rarity || undefined,
    search: search || undefined,
    limit: 100,
  });
  const { data: teamData } = useTeam();
  const { data: evolutionReady } = useEvolutionReady();
  const updateTeam = useUpdateTeam();
  const setNickname = useSetNickname();

  const pokemon = pokemonData?.pokemon ?? [];
  const total = pokemonData?.total ?? 0;

  const handleAddToTeam = async (pokemonId: string) => {
    const currentTeam = teamData?.map((p: TeamPokemon) => p.id) ?? [];
    if (currentTeam.length >= 6) {
      alert('Your team is full! Remove a Pokemon first.');
      return;
    }
    if (currentTeam.includes(pokemonId)) {
      alert('This Pokemon is already in your team!');
      return;
    }
    try {
      await updateTeam.mutateAsync([...currentTeam, pokemonId]);
      setSelectedPokemon(null);
    } catch (error) {
      console.error('Failed to add to team:', error);
    }
  };

  const handleRemoveFromTeam = async (pokemonId: string) => {
    const currentTeam = teamData?.map((p: TeamPokemon) => p.id) ?? [];
    try {
      await updateTeam.mutateAsync(currentTeam.filter((id: string) => id !== pokemonId));
      setSelectedPokemon(null);
    } catch (error) {
      console.error('Failed to remove from team:', error);
    }
  };

  const handleSetNickname = async () => {
    if (!selectedPokemon) return;
    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      setNicknameError('Nickname cannot be empty');
      return;
    }
    if (trimmed.length > 20) {
      setNicknameError('Nickname must be 20 characters or less');
      return;
    }
    try {
      await setNickname.mutateAsync({ pokemonId: selectedPokemon.id, nickname: trimmed });
      setNicknameInput('');
      setNicknameError('');
      setSelectedPokemon(null);
    } catch (error: any) {
      setNicknameError(error.message || 'Failed to set nickname');
    }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Collection</h1>
          <p className="text-gray-400">{total} Pokemon</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="input"
          >
            {RARITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-gray-400 hover:text-white text-sm"
            title="How leveling works"
          >
            {showInfo ? 'Hide Info' : '? Info'}
          </button>
        </div>
      </div>

      {/* Leveling Info */}
      {showInfo && (
        <div className="card border border-gray-700 text-sm space-y-2">
          <h3 className="font-bold text-pokemon-electric">How Leveling & Evolution Works</h3>
          <ul className="space-y-1 text-gray-300">
            <li><span className="text-gray-500">-</span> Pokemon gain <span className="text-pokemon-electric">10 XP/hour</span> passively over time.</li>
            <li><span className="text-gray-500">-</span> XP gain slows down at higher levels (diminishing returns).</li>
            <li><span className="text-gray-500">-</span> XP required per level: <span className="text-gray-400">level^2 x 10</span> (e.g. Lv.10 = 1000 XP).</li>
            <li><span className="text-gray-500">-</span> Max level is <span className="text-pokemon-electric">100</span>.</li>
            <li><span className="text-gray-500">-</span> When a Pokemon reaches the required level, it can <span className="text-purple-400">evolve</span>.</li>
            <li><span className="text-gray-500">-</span> Shiny Pokemon stay shiny after evolution.</li>
          </ul>
        </div>
      )}

      {/* Evolution Ready Banner */}
      {evolutionReady && evolutionReady.length > 0 && (
        <Link
          to="/evolution"
          className="card border border-purple-500/30 bg-purple-900/20 hover:border-purple-500/60 transition-colors block"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">✨</span>
            <span className="font-bold">{evolutionReady.length} Pokemon ready to evolve!</span>
            <span className="text-gray-400 text-sm ml-auto">Go to Evolution →</span>
          </div>
        </Link>
      )}

      {/* Pokemon Grid */}
      {pokemon.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {pokemon.map((p: CollectionPokemon) => (
            <div
              key={p.id}
              onClick={() => setSelectedPokemon(p)}
              className={`card p-2 cursor-pointer transition-all hover:scale-105 border-2 ${RARITY_COLORS[p.species.rarity] || 'border-gray-700'} ${p.isInTeam ? 'ring-2 ring-pokemon-electric' : ''}`}
            >
              <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center relative">
                {p.species.spriteUrl ? (
                  <img
                    src={p.isShiny ? p.species.spriteShinyUrl : p.species.spriteUrl}
                    alt={p.species.name}
                    className="w-full h-full object-contain pixelated"
                  />
                ) : (
                  <span className="text-3xl">?</span>
                )}
                {p.isShiny && (
                  <span className="absolute top-1 right-1 text-xs">✨</span>
                )}
                {p.isInTeam && (
                  <span className="absolute top-1 left-1 bg-pokemon-electric text-gray-900 text-xs px-1 rounded">
                    {p.teamPosition}
                  </span>
                )}
              </div>
              <p className="text-xs text-center mt-1 truncate capitalize">
                {p.nickname || p.species.name}
              </p>
              <p className="text-xs text-center text-pokemon-electric">
                Lv.{p.levelInfo?.level ?? p.level ?? 1}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-2xl font-bold mb-2">No Pokemon Yet</h2>
          <p className="text-gray-400 mb-4">
            {search || rarity
              ? 'No Pokemon match your filters.'
              : 'Visit the shop to get your first Pokemon!'}
          </p>
          <Link to="/shop" className="btn btn-primary">
            Go to Shop
          </Link>
        </div>
      )}

      {/* Pokemon Detail Modal */}
      {selectedPokemon && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPokemon(null)}
        >
          <div
            className="card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold capitalize">
                  {selectedPokemon.isShiny && <span className="text-yellow-400">✨ </span>}
                  {selectedPokemon.nickname || selectedPokemon.species.name}
                </h2>
                <p className={`${RARITY_TEXT_COLORS[selectedPokemon.species.rarity]} capitalize`}>
                  {selectedPokemon.species.rarity}
                </p>
              </div>
              <button
                onClick={() => setSelectedPokemon(null)}
                className="text-gray-400 hover:text-white"
              >
                X
              </button>
            </div>

            <div className="bg-gray-700 rounded-lg p-6 mb-4 flex items-center justify-center">
              {selectedPokemon.species.spriteUrl ? (
                <img
                  src={selectedPokemon.isShiny ? selectedPokemon.species.spriteShinyUrl : selectedPokemon.species.spriteUrl}
                  alt={selectedPokemon.species.name}
                  className="w-32 h-32 pixelated"
                />
              ) : (
                <span className="text-8xl">?</span>
              )}
            </div>

            <div className="space-y-3 mb-4">
              {/* Level & XP Progress */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Level</span>
                  <span className="text-pokemon-electric font-bold">
                    {selectedPokemon.levelInfo?.level ?? selectedPokemon.level ?? 1}
                    {selectedPokemon.levelInfo?.isMaxLevel && ' (MAX)'}
                  </span>
                </div>
                {!selectedPokemon.levelInfo?.isMaxLevel && (
                  <div className="relative">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pokemon-electric to-pokemon-fire transition-all"
                        style={{ width: `${selectedPokemon.levelInfo?.expProgress ?? 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{selectedPokemon.levelInfo?.expProgress ?? 0}%</span>
                      <span>{selectedPokemon.levelInfo?.expToNextLevel ?? '?'} XP to next</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Pokedex #</span>
                <span>{selectedPokemon.species.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Types</span>
                <span className="capitalize">{selectedPokemon.species.types?.join(', ') || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">In Team</span>
                <span>{selectedPokemon.isInTeam ? 'Yes' : 'No'}</span>
              </div>
              {selectedPokemon.isShiny && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Shiny</span>
                  <span className="text-yellow-400">Yes ✨</span>
                </div>
              )}

              {/* Nickname Section */}
              <div className="pt-3 border-t border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Nickname</span>
                  {selectedPokemon.nicknameSetAt ? (
                    <span className="text-pokemon-electric">
                      {selectedPokemon.nickname}
                      <span className="text-gray-500 text-xs ml-2">(permanent)</span>
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">Not set</span>
                  )}
                </div>
                {!selectedPokemon.nicknameSetAt && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter nickname (1-20 chars)"
                        value={nicknameInput}
                        onChange={(e) => {
                          setNicknameInput(e.target.value);
                          setNicknameError('');
                        }}
                        maxLength={20}
                        className="input flex-1 text-sm"
                      />
                      <button
                        onClick={handleSetNickname}
                        disabled={setNickname.isPending || !nicknameInput.trim()}
                        className="btn btn-secondary text-sm"
                      >
                        {setNickname.isPending ? '...' : 'Set'}
                      </button>
                    </div>
                    {nicknameError && (
                      <p className="text-red-400 text-xs">{nicknameError}</p>
                    )}
                    <p className="text-gray-500 text-xs">
                      Note: Nickname can only be set once!
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {selectedPokemon.isInTeam ? (
                <button
                  onClick={() => handleRemoveFromTeam(selectedPokemon.id)}
                  disabled={updateTeam.isPending}
                  className="btn btn-secondary flex-1"
                >
                  {updateTeam.isPending ? '...' : 'Remove from Team'}
                </button>
              ) : (
                <button
                  onClick={() => handleAddToTeam(selectedPokemon.id)}
                  disabled={updateTeam.isPending}
                  className="btn btn-primary flex-1"
                >
                  {updateTeam.isPending ? '...' : 'Add to Team'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
