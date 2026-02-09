import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEvolutionReady, useEvolvePokemon, useSuppressEvolution } from '../hooks/useApi';

interface EvolutionPokemon {
  id: string;
  nickname: string | null;
  isShiny: boolean;
  level: number;
  currentSpecies: {
    id: number;
    name: string;
    spriteUrl: string;
    spriteShinyUrl: string;
  };
  targetSpecies: {
    id: number;
    name: string;
    spriteUrl: string;
    spriteShinyUrl: string;
    evolutionLevel: number;
  };
}

interface EvolutionResult {
  pokemon: {
    id: string;
    previousSpeciesName: string;
    newSpeciesName: string;
    isShiny: boolean;
    level: number;
  };
  isNewPokedexEntry: boolean;
}

export default function Evolution() {
  const { data: evolutionReady, isLoading } = useEvolutionReady();
  const evolveMutation = useEvolvePokemon();
  const suppressMutation = useSuppressEvolution();

  const [selectedPokemon, setSelectedPokemon] = useState<EvolutionPokemon | null>(null);
  const [evolutionResult, setEvolutionResult] = useState<EvolutionResult | null>(null);
  const [isEvolving, setIsEvolving] = useState(false);

  const handleEvolve = async (pokemon: EvolutionPokemon) => {
    setSelectedPokemon(pokemon);
    setIsEvolving(true);

    try {
      const result = await evolveMutation.mutateAsync(pokemon.id);

      // Show evolution animation for a moment
      await new Promise(resolve => setTimeout(resolve, 1500));

      setEvolutionResult(result);
    } catch (error) {
      console.error('Evolution failed:', error);
      alert('Evolution failed!');
    } finally {
      setIsEvolving(false);
    }
  };

  const handleDismiss = async (pokemonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await suppressMutation.mutateAsync(pokemonId);
    } catch (error) {
      console.error('Failed to dismiss:', error);
    }
  };

  const closeResult = () => {
    setEvolutionResult(null);
    setSelectedPokemon(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pokemon-electric"></div>
      </div>
    );
  }

  const readyPokemon = evolutionReady ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Evolution</h1>
          <p className="text-gray-400">
            {readyPokemon.length} Pokemon ready to evolve
          </p>
        </div>
      </div>

      {readyPokemon.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {readyPokemon.map((pokemon: EvolutionPokemon) => (
            <div
              key={pokemon.id}
              className="card hover:ring-2 hover:ring-pokemon-electric transition-all cursor-pointer"
              onClick={() => handleEvolve(pokemon)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {pokemon.isShiny && <span className="text-yellow-400">✨</span>}
                  <span className="text-pokemon-electric font-bold">Lv.{pokemon.level}</span>
                </div>
                <button
                  onClick={(e) => handleDismiss(pokemon.id, e)}
                  className="text-gray-500 hover:text-gray-300 text-sm"
                  title="Dismiss notification"
                >
                  X
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 mb-4">
                {/* Current Pokemon */}
                <div className="text-center">
                  <div className="bg-gray-700 rounded-lg p-3 mb-2">
                    <img
                      src={pokemon.isShiny ? pokemon.currentSpecies.spriteShinyUrl : pokemon.currentSpecies.spriteUrl}
                      alt={pokemon.currentSpecies.name}
                      className="w-16 h-16 pixelated mx-auto"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <p className="text-sm capitalize font-medium">
                    {pokemon.nickname || pokemon.currentSpecies.name}
                  </p>
                  <p className="text-xs text-gray-400">#{pokemon.currentSpecies.id}</p>
                </div>

                {/* Arrow */}
                <div className="text-2xl text-pokemon-electric animate-pulse">
                  →
                </div>

                {/* Evolution Target */}
                <div className="text-center">
                  <div className="bg-gray-700 rounded-lg p-3 mb-2 ring-2 ring-pokemon-electric/50">
                    <img
                      src={pokemon.isShiny ? pokemon.targetSpecies.spriteShinyUrl : pokemon.targetSpecies.spriteUrl}
                      alt={pokemon.targetSpecies.name}
                      className="w-16 h-16 pixelated mx-auto"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <p className="text-sm capitalize font-medium">
                    {pokemon.targetSpecies.name}
                  </p>
                  <p className="text-xs text-gray-400">#{pokemon.targetSpecies.id}</p>
                </div>
              </div>

              <button
                className="btn btn-primary w-full"
                disabled={evolveMutation.isPending}
              >
                {evolveMutation.isPending ? 'Evolving...' : 'Evolve Now!'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">🥚</div>
          <h2 className="text-2xl font-bold mb-2">No Pokemon Ready to Evolve</h2>
          <p className="text-gray-400 mb-4">
            Your Pokemon need to level up more before they can evolve.
            <br />
            Pokemon gain experience passively over time!
          </p>
          <Link to="/collection" className="btn btn-primary">
            View Collection
          </Link>
        </div>
      )}

      {/* Evolution Animation Modal */}
      {isEvolving && selectedPokemon && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-8 text-pokemon-electric">
              What? {selectedPokemon.nickname || selectedPokemon.currentSpecies.name} is evolving!
            </h2>
            <div className="relative">
              <div className="animate-pulse">
                <img
                  src={selectedPokemon.isShiny
                    ? selectedPokemon.currentSpecies.spriteShinyUrl
                    : selectedPokemon.currentSpecies.spriteUrl
                  }
                  alt={selectedPokemon.currentSpecies.name}
                  className="w-32 h-32 pixelated mx-auto animate-ping"
                />
              </div>
              <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
            </div>
          </div>
        </div>
      )}

      {/* Evolution Result Modal */}
      {evolutionResult && selectedPokemon && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={closeResult}
        >
          <div
            className="card max-w-sm w-full text-center animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">Evolution Complete!</h2>

            <div className="bg-gray-700 rounded-lg p-6 mb-4">
              <img
                src={evolutionResult.pokemon.isShiny
                  ? selectedPokemon.targetSpecies.spriteShinyUrl
                  : selectedPokemon.targetSpecies.spriteUrl
                }
                alt={evolutionResult.pokemon.newSpeciesName}
                className="w-32 h-32 mx-auto pixelated"
              />
              <h3 className="text-xl font-bold capitalize mt-2">
                {evolutionResult.pokemon.isShiny && <span className="text-yellow-400">✨ </span>}
                {evolutionResult.pokemon.newSpeciesName}
                {evolutionResult.pokemon.isShiny && <span className="text-yellow-400"> ✨</span>}
              </h3>
              <p className="text-pokemon-electric">Lv.{evolutionResult.pokemon.level}</p>
            </div>

            <p className="text-gray-400 mb-4">
              {selectedPokemon.nickname || evolutionResult.pokemon.previousSpeciesName} evolved into {evolutionResult.pokemon.newSpeciesName}!
            </p>

            {evolutionResult.isNewPokedexEntry && (
              <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3 mb-4">
                <p className="text-green-400 font-medium">
                  New Pokedex Entry!
                </p>
              </div>
            )}

            <button onClick={closeResult} className="btn btn-primary w-full">
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
