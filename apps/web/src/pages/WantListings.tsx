import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWantListings, useMatchingPokemon, useAcceptWantListing } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';


export default function WantListings() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [selectedListing, setSelectedListing] = useState<string | null>(null);
  const { data, isLoading } = useWantListings({ page });
  const { data: matchingPokemon } = useMatchingPokemon(selectedListing || '');
  const acceptListing = useAcceptWantListing();

  const handleAccept = async (listingId: string, pokemonId: string) => {
    try {
      await acceptListing.mutateAsync({ listingId, pokemonId });
      setSelectedListing(null);
      alert('Trade completed successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to accept listing');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Want Listings</h1>
          <p className="text-gray-400 mt-1">Browse what other trainers are looking for</p>
        </div>
        {user && (
          <Link
            to="/my-listings"
            className="btn btn-primary"
          >
            My Listings
          </Link>
        )}
      </div>

      {data?.data.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">No want listings yet</p>
          <p className="text-sm text-gray-500 mt-2">
            Be the first to post what you're looking for!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((listing) => (
            <div key={listing.id} className="card">
              {/* Wanted Pokemon */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <img
                    src={listing.wantShiny
                      ? listing.wantedSpecies.spriteShinyUrl
                      : listing.wantedSpecies.spriteUrl
                    }
                    alt={listing.wantedSpecies.name}
                    className="w-20 h-20 pixelated"
                  />
                  {listing.wantShiny && (
                    <span className="absolute -top-1 -right-1 text-lg">✨</span>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-400">Looking for</p>
                  <h3 className="text-xl font-bold capitalize">
                    {listing.wantedSpecies.name}
                  </h3>
                  {listing.wantShiny && (
                    <span className="text-xs text-yellow-400">Shiny only</span>
                  )}
                </div>
              </div>

              {/* Offering */}
              <div className="border-t border-gray-700 pt-4 mb-4">
                <p className="text-sm text-gray-400 mb-2">Offering</p>
                <div className="flex flex-wrap items-center gap-2">
                  {listing.coinsOffered > 0 && (
                    <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold">
                      {listing.coinsOffered} coins
                    </span>
                  )}
                  {listing.offeredPokemon.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center gap-1 bg-gray-700 px-2 py-1 rounded"
                    >
                      <img
                        src={op.pokemon.isShiny
                          ? op.pokemon.species.spriteShinyUrl
                          : op.pokemon.species.spriteUrl
                        }
                        alt={op.pokemon.species.name}
                        className="w-6 h-6 pixelated"
                      />
                      <span className="text-xs capitalize">{op.pokemon.species.name}</span>
                      {op.pokemon.isShiny && <span className="text-xs">✨</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Posted by */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {listing.user.avatarUrl ? (
                    <img
                      src={listing.user.avatarUrl}
                      alt={listing.user.displayName}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs">
                      {listing.user.displayName[0]}
                    </div>
                  )}
                  <span className="text-gray-400">{listing.user.displayName}</span>
                </div>
                <span className="text-gray-500">
                  {listing._count.counterOffers} offers
                </span>
              </div>

              {/* Actions */}
              {user && user.id !== listing.userId && (
                <div className="mt-4 pt-4 border-t border-gray-700 flex gap-2">
                  <button
                    onClick={() => setSelectedListing(listing.id)}
                    className="btn btn-primary flex-1"
                  >
                    Accept
                  </button>
                  <Link
                    to={`/want-listings/${listing.id}`}
                    className="btn bg-gray-700 hover:bg-gray-600 flex-1 text-center"
                  >
                    Counter Offer
                  </Link>
                </div>
              )}

              {!user && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <Link to="/login" className="btn btn-primary w-full text-center">
                    Login to Trade
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn bg-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="flex items-center px-4">
            Page {page} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="btn bg-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Accept Modal */}
      {selectedListing && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedListing(null)}
        >
          <div
            className="card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Select Pokemon to Trade</h2>

            {matchingPokemon?.length === 0 ? (
              <p className="text-gray-400 text-center py-4">
                You don't have any matching Pokemon
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {matchingPokemon?.map((pokemon) => (
                  <button
                    key={pokemon.id}
                    onClick={() => handleAccept(selectedListing, pokemon.id)}
                    disabled={acceptListing.isPending}
                    className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    <img
                      src={pokemon.isShiny
                        ? pokemon.species.spriteShinyUrl
                        : pokemon.species.spriteUrl
                      }
                      alt={pokemon.species.name}
                      className="w-12 h-12 mx-auto pixelated"
                    />
                    <p className="text-xs text-center capitalize truncate">
                      {pokemon.species.name}
                    </p>
                    {pokemon.isShiny && (
                      <p className="text-xs text-center text-yellow-400">Shiny</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setSelectedListing(null)}
              className="btn bg-gray-700 w-full mt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
