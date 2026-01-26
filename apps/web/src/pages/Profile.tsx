import { useUser, useTeam, usePokemon, usePokedexStats, useUpdateTeam } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';

interface Pokemon {
  id: string;
  nickname: string | null;
  isShiny: boolean;
  teamPosition: number | null;
  species: {
    id: number;
    name: string;
    spriteUrl: string;
    rarity: string;
  };
}

export default function Profile() {
  const { user } = useAuthStore();
  const { data: userData } = useUser();
  const { data: team, isLoading: teamLoading } = useTeam();
  const { data: pokemonData } = usePokemon({ limit: 100 });
  const { data: pokedexStats } = usePokedexStats();
  const updateTeam = useUpdateTeam();

  const totalPokemon = pokemonData?.total ?? 0;
  const shiniesCount = pokemonData?.pokemon?.filter((p: any) => p.isShiny).length ?? 0;
  const totalObtained = pokedexStats?.totalObtained ?? 0;

  const handleRemoveFromTeam = async (pokemonId: string) => {
    const currentTeamIds = team?.map((p: Pokemon) => p.id) ?? [];
    try {
      await updateTeam.mutateAsync(currentTeamIds.filter((id: string) => id !== pokemonId));
    } catch (error) {
      console.error('Failed to remove from team:', error);
    }
  };

  // Sort team by position
  const sortedTeam = [...(team || [])].sort(
    (a: Pokemon, b: Pokemon) => (a.teamPosition ?? 0) - (b.teamPosition ?? 0)
  );

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">My Profile</h1>

      {/* Profile Card */}
      <div className="card">
        <div className="flex items-center gap-6">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-24 h-24 rounded-full"
            />
          ) : (
            <div className="w-24 h-24 bg-pokemon-electric rounded-full flex items-center justify-center text-4xl text-gray-900 font-bold">
              {user?.displayName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{user?.displayName || 'Trainer'}</h2>
            <p className="text-gray-400">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-pokemon-electric">🪙</span>
              <span className="font-bold text-xl">{user?.coins ?? 0}</span>
            </div>
            {userData?.streak !== undefined && userData.streak > 0 && (
              <p className="text-sm text-gray-400 mt-1">
                🔥 {userData.streak} day streak
              </p>
            )}
          </div>
        </div>
      </div>

      {/* My Team */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">My Team</h2>
          <span className="text-gray-400">{sortedTeam.length}/6</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => {
            const pokemon = sortedTeam[i] as Pokemon | undefined;

            return (
              <div
                key={i}
                className={`card aspect-square flex flex-col items-center justify-center relative ${
                  pokemon
                    ? 'bg-gray-700'
                    : 'border-2 border-dashed border-gray-700'
                }`}
              >
                {pokemon ? (
                  <>
                    {pokemon.species.spriteUrl ? (
                      <img
                        src={pokemon.isShiny
                          ? pokemon.species.spriteUrl.replace('/sprites/pokemon/', '/sprites/pokemon/shiny/')
                          : pokemon.species.spriteUrl
                        }
                        alt={pokemon.species.name}
                        className="w-16 h-16 pixelated"
                      />
                    ) : (
                      <span className="text-4xl">?</span>
                    )}
                    <p className="text-xs text-center mt-1 truncate w-full capitalize">
                      {pokemon.nickname || pokemon.species.name}
                    </p>
                    {pokemon.isShiny && (
                      <span className="absolute top-1 right-1 text-xs">✨</span>
                    )}
                    <button
                      onClick={() => handleRemoveFromTeam(pokemon.id)}
                      disabled={updateTeam.isPending}
                      className="absolute top-1 left-1 w-5 h-5 bg-red-500/80 rounded-full text-xs flex items-center justify-center hover:bg-red-500 transition-colors"
                    >
                      X
                    </button>
                    <span className="absolute bottom-1 right-1 text-xs text-gray-500">
                      #{i + 1}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-600 text-2xl">+</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-gray-400 text-sm mt-2">
          Add Pokemon to your team from your collection
        </p>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-3xl font-bold">{totalPokemon}</div>
            <div className="text-gray-400">Pokemon Owned</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold">{totalObtained}</div>
            <div className="text-gray-400">Pokedex Entries</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold">{userData?.tradesCompleted ?? 0}</div>
            <div className="text-gray-400">Trades Done</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold">{shiniesCount}</div>
            <div className="text-gray-400">Shinies</div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Account</h2>
        <div className="card space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-400">Member Since</span>
            <span>
              {userData?.createdAt
                ? new Date(userData.createdAt).toLocaleDateString()
                : 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Last Daily Claim</span>
            <span>
              {userData?.lastDailyClaim
                ? new Date(userData.lastDailyClaim).toLocaleDateString()
                : 'Never'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
