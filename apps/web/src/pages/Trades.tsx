import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMyWantListings, useMyCounterOffers } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';

type FilterTab = 'all' | 'completed' | 'pending';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-blue-500/20 text-blue-400',
  accepted: 'bg-green-500/20 text-green-400',
  open: 'bg-yellow-500/20 text-yellow-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  rejected: 'bg-red-500/20 text-red-400',
  withdrawn: 'bg-gray-500/20 text-gray-400',
  expired: 'bg-red-500/20 text-red-400',
};

interface PokemonSprite {
  name: string;
  spriteUrl: string;
  isShiny?: boolean;
}

interface TradeEntry {
  id: string;
  type: 'listing' | 'counter-offer';
  status: string;
  displayStatus: string;
  otherTrader: { displayName: string; avatarUrl: string | null };
  youGave: PokemonSprite[];
  youReceived: PokemonSprite[];
  coinsGave: number;
  coinsReceived: number;
  date: string;
  listingId: string;
}

export default function Trades() {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<FilterTab>('all');

  const { data: listings, isLoading: listingsLoading } = useMyWantListings();
  const { data: counterOffers, isLoading: offersLoading } = useMyCounterOffers();

  const isLoading = listingsLoading || offersLoading;

  const trades = useMemo(() => {
    if (!user) return [];
    const entries: TradeEntry[] = [];

    // From my want listings: completed = someone fulfilled my listing
    for (const listing of listings ?? []) {
      const acceptedOffer = listing.counterOffers?.find(
        (o) => o.status === 'accepted'
      );

      if (listing.status === 'completed' && acceptedOffer) {
        // Completed listing — I received what I wanted, gave my offered pokemon + coins
        entries.push({
          id: `listing-${listing.id}`,
          type: 'listing',
          status: 'completed',
          displayStatus: 'Completed',
          otherTrader: {
            displayName: acceptedOffer.user.displayName,
            avatarUrl: acceptedOffer.user.avatarUrl,
          },
          youReceived: [
            {
              name: listing.wantedSpecies.name,
              spriteUrl: listing.wantShiny
                ? listing.wantedSpecies.spriteShinyUrl
                : listing.wantedSpecies.spriteUrl,
              isShiny: listing.wantShiny,
            },
          ],
          youGave: listing.offeredPokemon.map((op) => ({
            name: op.pokemon.species.name,
            spriteUrl: op.pokemon.isShiny
              ? op.pokemon.species.spriteShinyUrl
              : op.pokemon.species.spriteUrl,
            isShiny: op.pokemon.isShiny,
          })),
          coinsGave: listing.coinsOffered,
          coinsReceived: acceptedOffer.coinsRequested,
          date: listing.createdAt,
          listingId: listing.id,
        });
      } else if (listing.status === 'open') {
        // Pending listing — still open
        entries.push({
          id: `listing-${listing.id}`,
          type: 'listing',
          status: 'open',
          displayStatus: 'Open Listing',
          otherTrader: { displayName: 'Waiting...', avatarUrl: null },
          youReceived: [
            {
              name: listing.wantedSpecies.name,
              spriteUrl: listing.wantShiny
                ? listing.wantedSpecies.spriteShinyUrl
                : listing.wantedSpecies.spriteUrl,
              isShiny: listing.wantShiny,
            },
          ],
          youGave: listing.offeredPokemon.map((op) => ({
            name: op.pokemon.species.name,
            spriteUrl: op.pokemon.isShiny
              ? op.pokemon.species.spriteShinyUrl
              : op.pokemon.species.spriteUrl,
            isShiny: op.pokemon.isShiny,
          })),
          coinsGave: listing.coinsOffered,
          coinsReceived: 0,
          date: listing.createdAt,
          listingId: listing.id,
        });
      }
    }

    // From my counter-offers: accepted = my offer was accepted by listing owner
    for (const offer of counterOffers ?? []) {
      if (offer.status === 'accepted') {
        entries.push({
          id: `offer-${offer.id}`,
          type: 'counter-offer',
          status: 'accepted',
          displayStatus: 'Completed',
          otherTrader: {
            displayName: offer.wantListing.user.displayName,
            avatarUrl: offer.wantListing.user.avatarUrl,
          },
          youGave: offer.offeredPokemon.map((op) => ({
            name: op.pokemon.species.name,
            spriteUrl: op.pokemon.species.spriteUrl,
            isShiny: op.pokemon.isShiny,
          })),
          youReceived: offer.requestedPokemon.map((rp) => ({
            name: rp.pokemon.species.name,
            spriteUrl: rp.pokemon.species.spriteUrl,
          })),
          coinsGave: 0,
          coinsReceived: offer.coinsRequested,
          date: offer.createdAt,
          listingId: offer.wantListing.id,
        });
      } else if (offer.status === 'pending') {
        entries.push({
          id: `offer-${offer.id}`,
          type: 'counter-offer',
          status: 'pending',
          displayStatus: 'Pending Offer',
          otherTrader: {
            displayName: offer.wantListing.user.displayName,
            avatarUrl: offer.wantListing.user.avatarUrl,
          },
          youGave: offer.offeredPokemon.map((op) => ({
            name: op.pokemon.species.name,
            spriteUrl: op.pokemon.species.spriteUrl,
            isShiny: op.pokemon.isShiny,
          })),
          youReceived: offer.requestedPokemon.map((rp) => ({
            name: rp.pokemon.species.name,
            spriteUrl: rp.pokemon.species.spriteUrl,
          })),
          coinsGave: 0,
          coinsReceived: offer.coinsRequested,
          date: offer.createdAt,
          listingId: offer.wantListing.id,
        });
      } else if (offer.status === 'rejected') {
        entries.push({
          id: `offer-${offer.id}`,
          type: 'counter-offer',
          status: 'rejected',
          displayStatus: 'Rejected',
          otherTrader: {
            displayName: offer.wantListing.user.displayName,
            avatarUrl: offer.wantListing.user.avatarUrl,
          },
          youGave: offer.offeredPokemon.map((op) => ({
            name: op.pokemon.species.name,
            spriteUrl: op.pokemon.species.spriteUrl,
            isShiny: op.pokemon.isShiny,
          })),
          youReceived: [],
          coinsGave: 0,
          coinsReceived: 0,
          date: offer.createdAt,
          listingId: offer.wantListing.id,
        });
      }
    }

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  }, [user, listings, counterOffers]);

  const filteredTrades = useMemo(() => {
    if (filter === 'all') return trades;
    if (filter === 'completed') {
      return trades.filter(
        (t) => t.status === 'completed' || t.status === 'accepted'
      );
    }
    // pending
    return trades.filter(
      (t) => t.status === 'open' || t.status === 'pending'
    );
  }, [trades, filter]);

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
        <h1 className="text-3xl font-bold">Trade History</h1>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'completed', 'pending'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`btn ${filter === tab ? 'btn-primary' : 'btn-secondary'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                (
                {tab === 'completed'
                  ? trades.filter(
                      (t) => t.status === 'completed' || t.status === 'accepted'
                    ).length
                  : trades.filter(
                      (t) => t.status === 'open' || t.status === 'pending'
                    ).length}
                )
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Trade List */}
      {filteredTrades.length > 0 ? (
        <div className="space-y-4">
          {filteredTrades.map((trade) => (
            <Link
              key={trade.id}
              to={`/want-listings/${trade.listingId}`}
              className="card block hover:ring-2 hover:ring-pokemon-electric transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {trade.otherTrader.avatarUrl ? (
                      <img
                        src={trade.otherTrader.avatarUrl}
                        alt={trade.otherTrader.displayName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      trade.otherTrader.displayName[0]?.toUpperCase() ?? '?'
                    )}
                  </div>
                  <div>
                    <p className="font-bold">{trade.otherTrader.displayName}</p>
                    <p className="text-sm text-gray-400">
                      {trade.type === 'listing'
                        ? 'Your listing'
                        : 'Your counter-offer'}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[trade.status] ?? 'bg-gray-500/20 text-gray-400'}`}
                >
                  {trade.displayStatus}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* You gave */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-2">You gave:</p>
                  <div className="flex gap-2 flex-wrap">
                    {trade.youGave.slice(0, 4).map((p, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center relative"
                        title={p.name}
                      >
                        <img
                          src={p.spriteUrl}
                          alt={p.name}
                          className="w-10 h-10 pixelated"
                          loading="lazy"
                          decoding="async"
                        />
                        {p.isShiny && (
                          <span className="absolute -top-1 -right-1 text-xs">✨</span>
                        )}
                      </div>
                    ))}
                    {trade.youGave.length > 4 && (
                      <span className="text-gray-400 text-sm self-center">
                        +{trade.youGave.length - 4}
                      </span>
                    )}
                    {trade.youGave.length === 0 && (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </div>
                  {trade.coinsGave > 0 && (
                    <p className="text-sm text-pokemon-electric mt-1">
                      +{trade.coinsGave} coins
                    </p>
                  )}
                </div>

                <div className="text-2xl shrink-0">⇄</div>

                {/* You received */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-2">You received:</p>
                  <div className="flex gap-2 flex-wrap">
                    {trade.youReceived.slice(0, 4).map((p, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center relative"
                        title={p.name}
                      >
                        <img
                          src={p.spriteUrl}
                          alt={p.name}
                          className="w-10 h-10 pixelated"
                          loading="lazy"
                          decoding="async"
                        />
                        {p.isShiny && (
                          <span className="absolute -top-1 -right-1 text-xs">✨</span>
                        )}
                      </div>
                    ))}
                    {trade.youReceived.length > 4 && (
                      <span className="text-gray-400 text-sm self-center">
                        +{trade.youReceived.length - 4}
                      </span>
                    )}
                    {trade.youReceived.length === 0 && (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </div>
                  {trade.coinsReceived > 0 && (
                    <p className="text-sm text-pokemon-electric mt-1">
                      +{trade.coinsReceived} coins
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                {new Date(trade.date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">🔄</div>
          <h2 className="text-2xl font-bold mb-2">No Trades Yet</h2>
          <p className="text-gray-400 mb-4">
            {filter !== 'all'
              ? `No ${filter} trades found.`
              : 'Create a want listing or make a counter-offer to start trading!'}
          </p>
          <Link to="/want-listings" className="btn btn-primary inline-block">
            Browse Want Listings
          </Link>
        </div>
      )}
    </div>
  );
}
