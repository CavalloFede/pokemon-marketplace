import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePublicProfile } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import TradeCreationModal from '../components/trades/TradeCreationModal';

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuthStore();
  const { data: profile, isLoading, error } = usePublicProfile(userId || '');
  const [showTradeModal, setShowTradeModal] = useState(false);

  // Redirect to own profile if viewing self
  if (userId === currentUser?.id) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">This is your profile!</p>
        <Link to="/profile" className="btn btn-primary">
          Go to My Profile
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pokemon-electric"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
        <p className="text-gray-400 mb-4">This trainer doesn't exist or has left the game.</p>
        <Link to="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    );
  }

  const team = profile.pokemon || [];
  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl">👤</span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{profile.displayName}</h1>
              <p className="text-gray-400">Trainer since {joinDate}</p>
            </div>
          </div>
          <button
            onClick={() => setShowTradeModal(true)}
            className="btn btn-primary"
          >
            Trade
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl mb-2">📦</div>
          <div className="text-2xl font-bold">{profile.stats.totalPokemon}</div>
          <div className="text-gray-400">Pokemon</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">📱</div>
          <div className="text-2xl font-bold">{profile.stats.pokedexCount}</div>
          <div className="text-gray-400">Pokedex Entries</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">✨</div>
          <div className="text-2xl font-bold">{profile.stats.shinyCount}</div>
          <div className="text-gray-400">Shinies</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-2">🔄</div>
          <div className="text-2xl font-bold">{profile.stats.tradesCompleted}</div>
          <div className="text-gray-400">Trades</div>
        </div>
      </div>

      {/* Team */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Team</h2>
        {team.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            This trainer hasn't set up their team yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {[...Array(6)].map((_, index) => {
              const pokemon = team.find(p => p.teamPosition === index + 1);

              return (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center ${
                    pokemon ? 'bg-gray-700' : 'bg-gray-800 border-2 border-dashed border-gray-700'
                  }`}
                >
                  {pokemon ? (
                    <>
                      <img
                        src={pokemon.isShiny ? pokemon.species.spriteShinyUrl : pokemon.species.spriteUrl}
                        alt={pokemon.species.name}
                        className="w-16 h-16 pixelated"
                      />
                      <span className="text-sm text-center mt-1 capitalize">
                        {pokemon.isShiny && <span className="text-yellow-400">✨</span>}
                        {pokemon.nickname || pokemon.species.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-600 text-2xl">?</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trade Modal */}
      <TradeCreationModal
        isOpen={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        preselectedUserId={userId}
      />
    </div>
  );
}
