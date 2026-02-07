import { useState } from 'react';
import { useTrades, useAcceptTrade, useRejectTrade, useCancelTrade } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import TradeCreationModal from '../components/trades/TradeCreationModal';

type TradeStatus = 'all' | 'pending' | 'accepted' | 'rejected' | 'expired';

interface TradePokemon {
  species: {
    name: string;
    spriteUrl: string;
  };
}

interface Trade {
  id: string;
  status: string;
  coinsOffered: number;
  expiresAt: string;
  createdAt: string;
  initiator: {
    id: string;
    displayName: string;
  };
  receiver: {
    id: string;
    displayName: string;
  };
  initiatorPokemon: TradePokemon[];
  receiverPokemon: TradePokemon[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  accepted: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  expired: 'bg-gray-500/20 text-gray-400',
};

export default function Trades() {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<TradeStatus>('all');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: trades, isLoading } = useTrades(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const acceptTrade = useAcceptTrade();
  const rejectTrade = useRejectTrade();
  const cancelTrade = useCancelTrade();

  const handleAccept = async (tradeId: string) => {
    try {
      await acceptTrade.mutateAsync(tradeId);
      setSelectedTrade(null);
    } catch (error: any) {
      console.error('Failed to accept trade:', error);
      alert(error.message || 'Failed to accept trade');
    }
  };

  const handleReject = async (tradeId: string) => {
    try {
      await rejectTrade.mutateAsync(tradeId);
      setSelectedTrade(null);
    } catch (error: any) {
      console.error('Failed to reject trade:', error);
      alert(error.message || 'Failed to reject trade');
    }
  };

  const handleCancel = async (tradeId: string) => {
    try {
      await cancelTrade.mutateAsync(tradeId);
      setSelectedTrade(null);
    } catch (error: any) {
      console.error('Failed to cancel trade:', error);
      alert(error.message || 'Failed to cancel trade');
    }
  };

  const isReceived = (trade: Trade) => trade.receiver.id === user?.id;
  const isSent = (trade: Trade) => trade.initiator.id === user?.id;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pokemon-electric"></div>
      </div>
    );
  }

  const tradeList = trades ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trades</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          New Trade
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'accepted', 'rejected', 'expired'] as TradeStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`btn ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Trade List */}
      {tradeList.length > 0 ? (
        <div className="space-y-4">
          {tradeList.map((trade: Trade) => {
            const received = isReceived(trade);
            const otherUser = received ? trade.initiator : trade.receiver;
            const myPokemon = received ? trade.receiverPokemon : trade.initiatorPokemon;
            const theirPokemon = received ? trade.initiatorPokemon : trade.receiverPokemon;

            return (
              <div
                key={trade.id}
                onClick={() => setSelectedTrade(trade)}
                className="card cursor-pointer hover:ring-2 hover:ring-pokemon-electric transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                      {otherUser.displayName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold">{otherUser.displayName}</p>
                      <p className="text-sm text-gray-400">
                        {received ? 'Wants to trade with you' : 'Trade offer sent'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[trade.status]}`}>
                    {trade.status}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Their Pokemon */}
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-2">They offer:</p>
                    <div className="flex gap-2">
                      {theirPokemon.slice(0, 3).map((p, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center"
                        >
                          {p.species.spriteUrl ? (
                            <img
                              src={p.species.spriteUrl}
                              alt={p.species.name}
                              className="w-10 h-10 pixelated"
                            />
                          ) : (
                            <span>?</span>
                          )}
                        </div>
                      ))}
                      {theirPokemon.length > 3 && (
                        <span className="text-gray-400 text-sm">+{theirPokemon.length - 3}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-2xl">⇄</div>

                  {/* My Pokemon */}
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-2">For your:</p>
                    <div className="flex gap-2">
                      {myPokemon.slice(0, 3).map((p, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center"
                        >
                          {p.species.spriteUrl ? (
                            <img
                              src={p.species.spriteUrl}
                              alt={p.species.name}
                              className="w-10 h-10 pixelated"
                            />
                          ) : (
                            <span>?</span>
                          )}
                        </div>
                      ))}
                      {myPokemon.length > 3 && (
                        <span className="text-gray-400 text-sm">+{myPokemon.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>

                {trade.coinsOffered > 0 && (
                  <p className="text-sm text-pokemon-electric mt-3">
                    +{trade.coinsOffered} 🪙 included
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">🔄</div>
          <h2 className="text-2xl font-bold mb-2">No Trades Yet</h2>
          <p className="text-gray-400 mb-4">
            {statusFilter !== 'all'
              ? `No ${statusFilter} trades found.`
              : 'Start a trade with another trainer!'}
          </p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Trade
          </button>
        </div>
      )}

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTrade(null)}
        >
          <div
            className="card max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Trade Details</h2>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-gray-400 hover:text-white"
              >
                X
              </button>
            </div>

            <div className={`px-3 py-1 rounded-full text-sm inline-block mb-4 ${STATUS_COLORS[selectedTrade.status]}`}>
              {selectedTrade.status}
            </div>

            {/* Trade parties */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-gray-600 rounded-full flex items-center justify-center text-xl">
                  {selectedTrade.initiator.displayName[0].toUpperCase()}
                </div>
                <p className="font-bold">{selectedTrade.initiator.displayName}</p>
                <p className="text-xs text-gray-400">
                  {isSent(selectedTrade) ? '(You)' : 'Offers'}
                </p>
              </div>

              <div className="text-3xl">⇄</div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-gray-600 rounded-full flex items-center justify-center text-xl">
                  {selectedTrade.receiver.displayName[0].toUpperCase()}
                </div>
                <p className="font-bold">{selectedTrade.receiver.displayName}</p>
                <p className="text-xs text-gray-400">
                  {isReceived(selectedTrade) ? '(You)' : 'Receives'}
                </p>
              </div>
            </div>

            {/* Pokemon offered */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">
                  {selectedTrade.initiator.displayName} offers:
                </p>
                <div className="space-y-2">
                  {selectedTrade.initiatorPokemon.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                      {p.species.spriteUrl ? (
                        <img
                          src={p.species.spriteUrl}
                          alt={p.species.name}
                          className="w-10 h-10 pixelated"
                        />
                      ) : (
                        <span className="w-10 h-10 flex items-center justify-center">?</span>
                      )}
                      <span className="capitalize text-sm">
                        {p.species.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">
                  {selectedTrade.receiver.displayName} offers:
                </p>
                <div className="space-y-2">
                  {selectedTrade.receiverPokemon.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                      {p.species.spriteUrl ? (
                        <img
                          src={p.species.spriteUrl}
                          alt={p.species.name}
                          className="w-10 h-10 pixelated"
                        />
                      ) : (
                        <span className="w-10 h-10 flex items-center justify-center">?</span>
                      )}
                      <span className="capitalize text-sm">
                        {p.species.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedTrade.coinsOffered > 0 && (
              <div className="bg-gray-700 rounded p-3 mb-4 text-center">
                <p className="text-pokemon-electric">
                  +{selectedTrade.coinsOffered} 🪙 from {selectedTrade.initiator.displayName}
                </p>
              </div>
            )}

            <div className="text-sm text-gray-400 mb-4">
              <p>Created: {new Date(selectedTrade.createdAt).toLocaleString()}</p>
              {selectedTrade.status === 'pending' && (
                <p>Expires: {new Date(selectedTrade.expiresAt).toLocaleString()}</p>
              )}
            </div>

            {/* Actions */}
            {selectedTrade.status === 'pending' && isReceived(selectedTrade) && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(selectedTrade.id)}
                  disabled={acceptTrade.isPending || rejectTrade.isPending}
                  className="btn btn-primary flex-1"
                >
                  {acceptTrade.isPending ? '...' : 'Accept'}
                </button>
                <button
                  onClick={() => handleReject(selectedTrade.id)}
                  disabled={acceptTrade.isPending || rejectTrade.isPending}
                  className="btn btn-secondary flex-1"
                >
                  {rejectTrade.isPending ? '...' : 'Reject'}
                </button>
              </div>
            )}

            {selectedTrade.status === 'pending' && isSent(selectedTrade) && (
              <div className="space-y-3">
                <p className="text-center text-gray-400">
                  Waiting for {selectedTrade.receiver.displayName} to respond...
                </p>
                <button
                  onClick={() => handleCancel(selectedTrade.id)}
                  disabled={cancelTrade.isPending}
                  className="btn btn-secondary w-full"
                >
                  {cancelTrade.isPending ? 'Cancelling...' : 'Cancel Trade'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trade Creation Modal */}
      <TradeCreationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
