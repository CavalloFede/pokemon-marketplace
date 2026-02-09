import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useWantListing,
  useMatchingPokemon,
  usePokemon,
  useAcceptWantListing,
  useCreateCounterOffer,
  useAcceptCounterOffer,
  useRejectCounterOffer
} from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-500/20 text-green-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  expired: 'bg-red-500/20 text-red-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  accepted: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  withdrawn: 'bg-gray-500/20 text-gray-400',
};

export default function WantListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: listing, isLoading } = useWantListing(id || '');
  const { data: matchingPokemon } = useMatchingPokemon(id || '');

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showCounterOfferModal, setShowCounterOfferModal] = useState(false);

  const acceptListing = useAcceptWantListing();
  const acceptCounterOffer = useAcceptCounterOffer();
  const rejectCounterOffer = useRejectCounterOffer();

  const isOwner = user?.id === listing?.userId;
  const canAccept = !isOwner && listing?.status === 'open' && (matchingPokemon?.length || 0) > 0;
  const canCounterOffer = !isOwner && listing?.status === 'open';

  const handleAccept = async (pokemonId: string) => {
    if (!id) return;
    try {
      await acceptListing.mutateAsync({ listingId: id, pokemonId });
      setShowAcceptModal(false);
      alert('Trade completed successfully!');
      navigate('/my-listings');
    } catch (error: any) {
      alert(error.message || 'Failed to accept listing');
    }
  };

  const handleAcceptCounterOffer = async (offerId: string) => {
    try {
      await acceptCounterOffer.mutateAsync(offerId);
      alert('Counter-offer accepted! Trade completed.');
      navigate('/want-listings');
    } catch (error: any) {
      alert(error.message || 'Failed to accept counter-offer');
    }
  };

  const handleRejectCounterOffer = async (offerId: string) => {
    try {
      await rejectCounterOffer.mutateAsync(offerId);
    } catch (error: any) {
      alert(error.message || 'Failed to reject counter-offer');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pokemon-electric"></div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-gray-400">Listing not found</h1>
        <Link to="/want-listings" className="btn btn-primary mt-4 inline-block">
          Back to Listings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link to="/want-listings" className="text-gray-400 hover:text-white flex items-center gap-2">
        &larr; Back to Listings
      </Link>

      {/* Main listing card */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <span className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[listing.status]}`}>
            {listing.status}
          </span>
          <span className="text-sm text-gray-400">
            Posted {new Date(listing.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Wanted Pokemon */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <img
              src={listing.wantShiny
                ? listing.wantedSpecies.spriteShinyUrl
                : listing.wantedSpecies.spriteUrl
              }
              alt={listing.wantedSpecies.name}
              className="w-32 h-32 pixelated"
            />
            {listing.wantShiny && (
              <span className="absolute -top-2 -right-2 text-2xl">✨</span>
            )}
          </div>
          <div>
            <p className="text-gray-400 mb-1">Looking for</p>
            <h1 className="text-3xl font-bold capitalize">{listing.wantedSpecies.name}</h1>
            {listing.wantShiny && (
              <span className="text-yellow-400 text-sm">Shiny only</span>
            )}
          </div>
        </div>

        {/* Posted by */}
        <div className="flex items-center gap-3 mb-6 p-4 bg-gray-700/50 rounded-lg">
          {listing.user.avatarUrl ? (
            <img
              src={listing.user.avatarUrl}
              alt={listing.user.displayName}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-xl">
              {listing.user.displayName[0]}
            </div>
          )}
          <div>
            <p className="text-sm text-gray-400">Posted by</p>
            <p className="font-bold">{listing.user.displayName}</p>
          </div>
        </div>

        {/* Offering */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Offering</h2>
          <div className="flex flex-wrap gap-4">
            {listing.coinsOffered > 0 && (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
                <span className="text-3xl">🪙</span>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">{listing.coinsOffered}</p>
                  <p className="text-sm text-gray-400">coins</p>
                </div>
              </div>
            )}
            {listing.offeredPokemon.map((op) => (
              <div
                key={op.id}
                className="bg-gray-700 rounded-lg p-4 flex items-center gap-3"
              >
                <img
                  src={op.pokemon.isShiny
                    ? op.pokemon.species.spriteShinyUrl
                    : op.pokemon.species.spriteUrl
                  }
                  alt={op.pokemon.species.name}
                  className="w-16 h-16 pixelated"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <p className="font-bold capitalize">{op.pokemon.species.name}</p>
                  {op.pokemon.isShiny && (
                    <span className="text-yellow-400 text-sm">✨ Shiny</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions for non-owner */}
        {user && !isOwner && listing.status === 'open' && (
          <div className="flex gap-4 pt-6 border-t border-gray-700">
            <button
              onClick={() => setShowAcceptModal(true)}
              disabled={!canAccept}
              className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canAccept ? 'Accept Listing' : 'No matching Pokemon'}
            </button>
            <button
              onClick={() => setShowCounterOfferModal(true)}
              disabled={!canCounterOffer}
              className="btn bg-purple-500 hover:bg-purple-600 flex-1 disabled:opacity-50"
            >
              Make Counter-Offer
            </button>
          </div>
        )}

        {!user && (
          <div className="pt-6 border-t border-gray-700">
            <Link to="/login" className="btn btn-primary w-full text-center">
              Login to Trade
            </Link>
          </div>
        )}
      </div>

      {/* Counter Offers Section (for owner) */}
      {isOwner && listing.counterOffers.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">
            Counter Offers ({listing.counterOffers.filter(o => o.status === 'pending').length} pending)
          </h2>
          <div className="space-y-4">
            {listing.counterOffers.map((offer) => (
              <div
                key={offer.id}
                className={`p-4 rounded-lg border ${
                  offer.status === 'pending'
                    ? 'bg-gray-700/50 border-gray-600'
                    : 'bg-gray-800/50 border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* User */}
                    <div className="flex items-center gap-2">
                      {offer.user.avatarUrl ? (
                        <img
                          src={offer.user.avatarUrl}
                          alt={offer.user.displayName}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                          {offer.user.displayName[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{offer.user.displayName}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(offer.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* What they're offering */}
                    <div className="flex items-center gap-1 bg-gray-700 px-3 py-2 rounded">
                      {offer.offeredPokemon.map((op: any) => (
                        <div key={op.id} className="flex items-center gap-1">
                          <img
                            src={op.pokemon.isShiny
                              ? op.pokemon.species.spriteShinyUrl
                              : op.pokemon.species.spriteUrl
                            }
                            alt={op.pokemon.species.name}
                            className="w-10 h-10 pixelated"
                          />
                          <div>
                            <p className="text-sm font-medium capitalize">
                              {op.pokemon.species.name}
                            </p>
                            {op.pokemon.isShiny && (
                              <span className="text-xs text-yellow-400">✨</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* What they want */}
                    <div className="text-sm">
                      <p className="text-gray-400">Wants:</p>
                      {offer.coinsRequested > 0 && (
                        <p className="text-yellow-400">{offer.coinsRequested} coins</p>
                      )}
                      {offer.requestedPokemon.length > 0 && (
                        <p>{offer.requestedPokemon.length} Pokemon</p>
                      )}
                    </div>
                  </div>

                  {/* Status/Actions */}
                  <div className="flex items-center gap-2">
                    {offer.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleAcceptCounterOffer(offer.id)}
                          disabled={acceptCounterOffer.isPending}
                          className="btn bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectCounterOffer(offer.id)}
                          disabled={rejectCounterOffer.isPending}
                          className="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[offer.status]}`}>
                        {offer.status}
                      </span>
                    )}
                  </div>
                </div>

                {offer.message && (
                  <p className="mt-3 text-sm text-gray-400 italic">"{offer.message}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counter Offers for non-owner viewing */}
      {!isOwner && listing.counterOffers.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-2">
            {listing.counterOffers.length} Counter Offer{listing.counterOffers.length !== 1 ? 's' : ''}
          </h2>
          <p className="text-gray-400 text-sm">
            Other trainers have made offers on this listing
          </p>
        </div>
      )}

      {/* Accept Modal */}
      {showAcceptModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAcceptModal(false)}
        >
          <div
            className="card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Select Pokemon to Trade</h2>
            <p className="text-gray-400 text-sm mb-4">
              Choose which {listing.wantedSpecies.name} to trade for this offer
            </p>

            <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
              {matchingPokemon?.map((pokemon) => (
                <button
                  key={pokemon.id}
                  onClick={() => handleAccept(pokemon.id)}
                  disabled={acceptListing.isPending}
                  className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <img
                    src={pokemon.isShiny
                      ? pokemon.species.spriteShinyUrl
                      : pokemon.species.spriteUrl
                    }
                    alt={pokemon.species.name}
                    className="w-16 h-16 mx-auto pixelated"
                  />
                  <p className="text-xs text-center capitalize mt-1">
                    {pokemon.species.name}
                  </p>
                  {pokemon.isShiny && (
                    <p className="text-xs text-center text-yellow-400">✨ Shiny</p>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAcceptModal(false)}
              className="btn bg-gray-700 w-full mt-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Counter Offer Modal */}
      {showCounterOfferModal && listing && (
        <CounterOfferModal
          listing={listing}
          matchingPokemon={matchingPokemon || []}
          onClose={() => setShowCounterOfferModal(false)}
        />
      )}
    </div>
  );
}

interface CounterOfferModalProps {
  listing: any;
  matchingPokemon: any[];
  onClose: () => void;
}

function CounterOfferModal({ listing, matchingPokemon, onClose }: CounterOfferModalProps) {
  const createCounterOffer = useCreateCounterOffer();
  const [pokemonSearch, setPokemonSearch] = useState('');
  const { data: collectionData } = usePokemon({ search: pokemonSearch || undefined, limit: 50 });
  const allPokemon = collectionData?.pokemon ?? [];

  const [selectedPokemonIds, setSelectedPokemonIds] = useState<string[]>([]);
  const [coinsRequested, setCoinsRequested] = useState(listing.coinsOffered);
  // Auto-select all offered Pokemon from the listing
  const [requestedPokemonIds, setRequestedPokemonIds] = useState<string[]>(
    listing.offeredPokemon.map((op: any) => op.pokemon.id)
  );
  const [message, setMessage] = useState('');

  const toggleOfferedPokemon = (id: string) => {
    setSelectedPokemonIds(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selectedPokemonIds.length === 0) {
      alert('Please select at least one Pokemon to offer');
      return;
    }

    if (coinsRequested <= 0 && requestedPokemonIds.length === 0) {
      alert('Please request coins or Pokemon');
      return;
    }

    try {
      await createCounterOffer.mutateAsync({
        wantListingId: listing.id,
        offeredPokemonIds: selectedPokemonIds,
        coinsRequested,
        requestedPokemonIds,
        message: message || undefined
      });
      alert('Counter-offer sent!');
      onClose();
    } catch (error: any) {
      alert(error.message || 'Failed to create counter-offer');
    }
  };

  const toggleRequestedPokemon = (id: string) => {
    setRequestedPokemonIds(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-2">Make Counter-Offer</h2>
        <p className="text-gray-400 text-sm mb-6">
          Offer a different deal to {listing.user.displayName}
        </p>

        {/* Step 1: Select Pokemon to offer */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">
            1. Select Pokemon to offer ({selectedPokemonIds.length} selected)
          </h3>
          <input
            type="text"
            value={pokemonSearch}
            onChange={(e) => setPokemonSearch(e.target.value)}
            className="w-full px-3 py-2 mb-3 bg-gray-700 rounded border border-gray-600 focus:border-pokemon-electric focus:outline-none text-sm"
            placeholder="Search your collection..."
          />
          {matchingPokemon.length > 0 && !pokemonSearch && (
            <p className="text-xs text-green-400 mb-2">
              Matching {listing.wantedSpecies.name} shown first
            </p>
          )}
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {/* Show matching Pokemon first when not searching */}
            {!pokemonSearch && matchingPokemon.map((pokemon) => (
              <button
                key={pokemon.id}
                onClick={() => toggleOfferedPokemon(pokemon.id)}
                className={`p-2 rounded transition-colors ring-2 ring-green-500/50 ${
                  selectedPokemonIds.includes(pokemon.id)
                    ? 'bg-pokemon-electric text-gray-900'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <img
                  src={pokemon.isShiny
                    ? pokemon.species.spriteShinyUrl
                    : pokemon.species.spriteUrl
                  }
                  alt={pokemon.species.name}
                  className="w-12 h-12 mx-auto pixelated"
                />
                <p className="text-xs text-center capitalize truncate">{pokemon.species.name}</p>
                {pokemon.isShiny && <span className="text-xs">✨</span>}
              </button>
            ))}
            {/* Show rest of collection */}
            {allPokemon
              .filter((p) => !pokemonSearch ? !matchingPokemon.some((m) => m.id === p.id) : true)
              .map((pokemon) => (
              <button
                key={pokemon.id}
                onClick={() => toggleOfferedPokemon(pokemon.id)}
                className={`p-2 rounded transition-colors ${
                  selectedPokemonIds.includes(pokemon.id)
                    ? 'bg-pokemon-electric text-gray-900'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <img
                  src={pokemon.isShiny
                    ? pokemon.species.spriteShinyUrl
                    : pokemon.species.spriteUrl
                  }
                  alt={pokemon.species.name}
                  className="w-12 h-12 mx-auto pixelated"
                />
                <p className="text-xs text-center capitalize truncate">{pokemon.species.name}</p>
                {pokemon.isShiny && <span className="text-xs">✨</span>}
              </button>
            ))}
          </div>
          {allPokemon.length === 0 && matchingPokemon.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No Pokemon found</p>
          )}
        </div>

        {/* Step 2: Request coins */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">
            2. Request coins (original offer: {listing.coinsOffered})
          </h3>
          <input
            type="number"
            min="0"
            value={coinsRequested}
            onChange={(e) => setCoinsRequested(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-pokemon-electric focus:outline-none"
            placeholder="Enter coins to request"
          />
        </div>

        {/* Step 3: Request Pokemon (auto-selected, can deselect) */}
        {listing.offeredPokemon.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">
              3. Pokemon you'll receive ({requestedPokemonIds.length}/{listing.offeredPokemon.length})
            </h3>
            <p className="text-xs text-gray-400 mb-2">All selected by default. Tap to deselect.</p>
            <div className="grid grid-cols-4 gap-2">
              {listing.offeredPokemon.map((op: any) => (
                <button
                  key={op.pokemon.id}
                  onClick={() => toggleRequestedPokemon(op.pokemon.id)}
                  className={`p-2 rounded transition-colors ${
                    requestedPokemonIds.includes(op.pokemon.id)
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 opacity-50'
                  }`}
                >
                  <img
                    src={op.pokemon.isShiny
                      ? op.pokemon.species.spriteShinyUrl
                      : op.pokemon.species.spriteUrl
                    }
                    alt={op.pokemon.species.name}
                    className="w-12 h-12 mx-auto pixelated"
                  />
                  <p className="text-xs text-center capitalize truncate">
                    {op.pokemon.species.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Message */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">4. Add a message (optional)</h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-pokemon-electric focus:outline-none resize-none"
            rows={2}
            placeholder="Explain your counter-offer..."
            maxLength={200}
          />
        </div>

        {/* Summary */}
        <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
          <h3 className="font-medium mb-2">Summary</h3>
          <p className="text-sm text-gray-400">
            You offer: {selectedPokemonIds.length > 0 ? `${selectedPokemonIds.length} Pokemon` : 'No Pokemon selected'}
          </p>
          <p className="text-sm text-gray-400">
            You request: {coinsRequested > 0 ? `${coinsRequested} coins` : ''}
            {coinsRequested > 0 && requestedPokemonIds.length > 0 ? ' + ' : ''}
            {requestedPokemonIds.length > 0 ? `${requestedPokemonIds.length} Pokemon` : ''}
            {coinsRequested === 0 && requestedPokemonIds.length === 0 ? 'Nothing selected' : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="btn bg-gray-700 flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createCounterOffer.isPending || selectedPokemonIds.length === 0}
            className="btn bg-purple-500 hover:bg-purple-600 flex-1 disabled:opacity-50"
          >
            {createCounterOffer.isPending ? 'Sending...' : 'Send Counter-Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}
