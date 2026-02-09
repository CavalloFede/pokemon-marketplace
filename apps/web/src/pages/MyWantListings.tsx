import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useMyWantListings,
  useCancelWantListing,
  useAcceptCounterOffer,
  useRejectCounterOffer,
  useMyCounterOffers,
  useWithdrawCounterOffer,
  usePokemon,
  usePokedex,
  useCreateWantListing
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

export default function MyWantListings() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'listings' | 'offers'>('listings');

  const { data: listings, isLoading: listingsLoading } = useMyWantListings();
  const { data: counterOffers, isLoading: offersLoading } = useMyCounterOffers();
  const cancelListing = useCancelWantListing();
  const acceptCounterOffer = useAcceptCounterOffer();
  const rejectCounterOffer = useRejectCounterOffer();
  const withdrawCounterOffer = useWithdrawCounterOffer();

  const handleCancelListing = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this listing?')) return;
    try {
      await cancelListing.mutateAsync(id);
    } catch (error: any) {
      alert(error.message || 'Failed to cancel listing');
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      await acceptCounterOffer.mutateAsync(offerId);
      alert('Counter-offer accepted! Trade completed.');
    } catch (error: any) {
      alert(error.message || 'Failed to accept counter-offer');
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    try {
      await rejectCounterOffer.mutateAsync(offerId);
    } catch (error: any) {
      alert(error.message || 'Failed to reject counter-offer');
    }
  };

  const handleWithdrawOffer = async (offerId: string) => {
    if (!confirm('Withdraw this counter-offer?')) return;
    try {
      await withdrawCounterOffer.mutateAsync(offerId);
    } catch (error: any) {
      alert(error.message || 'Failed to withdraw counter-offer');
    }
  };

  const isLoading = listingsLoading || offersLoading;

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
          <h1 className="text-3xl font-bold">My Trading</h1>
          <p className="text-gray-400 mt-1">Manage your want listings and offers</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          Create Listing
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('listings')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'listings'
              ? 'text-pokemon-electric border-b-2 border-pokemon-electric'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          My Listings ({listings?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'offers'
              ? 'text-pokemon-electric border-b-2 border-pokemon-electric'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          My Offers ({counterOffers?.length || 0})
        </button>
      </div>

      {/* Listings Tab */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {listings?.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400">You haven't created any listings yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary mt-4"
              >
                Create Your First Listing
              </button>
            </div>
          ) : (
            listings?.map((listing) => (
              <div key={listing.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  {/* Listing Info */}
                  <div className="flex items-center gap-4">
                    <img
                      src={listing.wantShiny
                        ? listing.wantedSpecies.spriteShinyUrl
                        : listing.wantedSpecies.spriteUrl
                      }
                      alt={listing.wantedSpecies.name}
                      className="w-16 h-16 pixelated"
                      loading="lazy"
                      decoding="async"
                    />
                    <div>
                      <h3 className="font-bold capitalize flex items-center gap-2">
                        Looking for: {listing.wantedSpecies.name}
                        {listing.wantShiny && <span className="text-yellow-400">✨</span>}
                      </h3>
                      <p className="text-sm text-gray-400">
                        Offering: {listing.coinsOffered > 0 ? `${listing.coinsOffered} coins` : ''}
                        {listing.coinsOffered > 0 && listing.offeredPokemon.length > 0 ? ' + ' : ''}
                        {listing.offeredPokemon.length > 0
                          ? `${listing.offeredPokemon.length} Pokemon`
                          : ''
                        }
                      </p>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[listing.status]}`}>
                      {listing.status}
                    </span>
                    {listing.status === 'open' && (
                      <button
                        onClick={() => handleCancelListing(listing.id)}
                        disabled={cancelListing.isPending}
                        className="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Counter Offers */}
                {listing.counterOffers.length > 0 && listing.status === 'open' && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">
                      Counter Offers ({listing.counterOffers.length})
                    </h4>
                    <div className="space-y-2">
                      {listing.counterOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="flex items-center justify-between bg-gray-700/50 p-3 rounded"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={offer.offeredPokemon.species.spriteUrl}
                              alt={offer.offeredPokemon.species.name}
                              className="w-10 h-10 pixelated"
                              loading="lazy"
                              decoding="async"
                            />
                            <div>
                              <p className="font-medium">{offer.user.displayName}</p>
                              <p className="text-sm text-gray-400">
                                Wants: {offer.coinsRequested > 0 ? `${offer.coinsRequested} coins` : 'Pokemon only'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptOffer(offer.id)}
                              disabled={acceptCounterOffer.isPending}
                              className="btn bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRejectOffer(offer.id)}
                              disabled={rejectCounterOffer.isPending}
                              className="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Counter Offers Tab */}
      {activeTab === 'offers' && (
        <div className="space-y-4">
          {counterOffers?.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400">You haven't made any counter-offers yet</p>
              <Link to="/want-listings" className="btn btn-primary mt-4 inline-block">
                Browse Listings
              </Link>
            </div>
          ) : (
            counterOffers?.map((offer) => (
              <div key={offer.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={offer.wantListing.wantedSpecies.spriteUrl}
                      alt={offer.wantListing.wantedSpecies.name}
                      className="w-12 h-12 pixelated"
                      loading="lazy"
                      decoding="async"
                    />
                    <div>
                      <p className="text-sm text-gray-400">
                        Offer to {offer.wantListing.user.displayName}
                      </p>
                      <h3 className="font-bold capitalize">
                        {offer.wantListing.wantedSpecies.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        You offered: {offer.offeredPokemon.species.name}
                        {offer.coinsRequested > 0 ? ` (asking ${offer.coinsRequested} coins)` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[offer.status]}`}>
                      {offer.status}
                    </span>
                    {offer.status === 'pending' && (
                      <button
                        onClick={() => handleWithdrawOffer(offer.id)}
                        disabled={withdrawCounterOffer.isPending}
                        className="btn bg-gray-600 hover:bg-gray-500 text-sm"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Listing Modal */}
      {showCreateModal && (
        <CreateListingModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function CreateListingModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const { data: pokemonData } = usePokemon({ limit: 100 });
  const { data: pokedexData } = usePokedex();
  const createListing = useCreateWantListing();

  const [wantedSpeciesId, setWantedSpeciesId] = useState<number | null>(null);
  const [wantShiny, setWantShiny] = useState(false);
  const [coinsOffered, setCoinsOffered] = useState(0);
  const [selectedPokemon, setSelectedPokemon] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Get all species for selection
  const allSpecies = pokedexData?.entries?.map(e => e.species) || [];
  const filteredSpecies = allSpecies.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!wantedSpeciesId) {
      alert('Please select a Pokemon you want');
      return;
    }

    if (coinsOffered <= 0 && selectedPokemon.length === 0) {
      alert('Please offer coins or Pokemon');
      return;
    }

    try {
      await createListing.mutateAsync({
        wantedSpeciesId,
        wantShiny,
        coinsOffered,
        offeredPokemonIds: selectedPokemon,
      });
      onClose();
    } catch (error: any) {
      alert(error.message || 'Failed to create listing');
    }
  };

  const togglePokemon = (id: string) => {
    setSelectedPokemon(prev =>
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
        <h2 className="text-2xl font-bold mb-6">Create Want Listing</h2>

        {/* What you want */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            What Pokemon do you want?
          </label>
          <input
            type="text"
            placeholder="Search Pokemon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-pokemon-electric focus:outline-none mb-2"
          />
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto">
            {filteredSpecies.slice(0, 30).map((species) => (
              <button
                key={species.id}
                onClick={() => setWantedSpeciesId(species.id)}
                className={`p-2 rounded transition-colors ${
                  wantedSpeciesId === species.id
                    ? 'bg-pokemon-electric text-gray-900'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <img
                  src={species.spriteUrl}
                  alt={species.name}
                  className="w-8 h-8 mx-auto pixelated"
                  loading="lazy"
                  decoding="async"
                />
                <p className="text-xs text-center capitalize truncate">{species.name}</p>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={wantShiny}
              onChange={(e) => setWantShiny(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
            <span className="text-sm">Shiny only</span>
          </label>
        </div>

        {/* Coins to offer */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Coins to offer (You have: {user?.coins || 0})
          </label>
          <input
            type="number"
            min="0"
            max={user?.coins || 0}
            value={coinsOffered}
            onChange={(e) => setCoinsOffered(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-pokemon-electric focus:outline-none"
          />
        </div>

        {/* Pokemon to offer */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Pokemon to offer ({selectedPokemon.length} selected)
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto">
            {pokemonData?.pokemon?.map((p: any) => (
              <button
                key={p.id}
                onClick={() => togglePokemon(p.id)}
                className={`p-2 rounded transition-colors ${
                  selectedPokemon.includes(p.id)
                    ? 'bg-pokemon-electric text-gray-900'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <img
                  src={p.isShiny ? p.species.spriteShinyUrl : p.species.spriteUrl}
                  alt={p.species.name}
                  className="w-8 h-8 mx-auto pixelated"
                  loading="lazy"
                  decoding="async"
                />
                <p className="text-xs text-center capitalize truncate">{p.species.name}</p>
                {p.isShiny && <span className="text-xs">✨</span>}
              </button>
            ))}
          </div>
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
            disabled={createListing.isPending || !wantedSpeciesId}
            className="btn btn-primary flex-1 disabled:opacity-50"
          >
            {createListing.isPending ? 'Creating...' : 'Create Listing'}
          </button>
        </div>
      </div>
    </div>
  );
}
