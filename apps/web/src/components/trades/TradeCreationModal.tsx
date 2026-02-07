import { useState, useEffect } from 'react';
import { useUsers, useUserPokemon, usePokemon, useCreateTrade } from '../../hooks/useApi';
import { useAuthStore } from '../../store/authStore';

interface Pokemon {
  id: string;
  nickname: string | null;
  isShiny: boolean;
  level?: number;
  species: {
    id?: number;
    name: string;
    spriteUrl: string;
    spriteShinyUrl?: string;
    rarity?: string;
  };
}

interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedUserId?: string;
}

const RARITY_COLORS: Record<string, string> = {
  common: 'border-gray-500',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-yellow-500',
  mythical: 'border-pink-500',
};

export default function TradeCreationModal({ isOpen, onClose, preselectedUserId }: Props) {
  const { user: currentUser } = useAuthStore();
  const [step, setStep] = useState<'select-user' | 'select-pokemon' | 'confirm'>(
    preselectedUserId ? 'select-pokemon' : 'select-user'
  );
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [mySelectedPokemon, setMySelectedPokemon] = useState<Pokemon[]>([]);
  const [theirSelectedPokemon, setTheirSelectedPokemon] = useState<Pokemon[]>([]);
  const [coinsOffered, setCoinsOffered] = useState(0);
  const [message, setMessage] = useState('');

  const { data: usersData } = useUsers({ page: 1 });
  const { data: myPokemonData } = usePokemon({ limit: 100 });
  const { data: theirPokemonData } = useUserPokemon(selectedUser?.id || '', { page: 1 });
  const createTrade = useCreateTrade();

  // Set preselected user
  useEffect(() => {
    if (preselectedUserId && usersData?.data) {
      const user = usersData.data.find(u => u.id === preselectedUserId);
      if (user) {
        setSelectedUser(user);
        setStep('select-pokemon');
      }
    }
  }, [preselectedUserId, usersData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep(preselectedUserId ? 'select-pokemon' : 'select-user');
      setSelectedUser(null);
      setUserSearch('');
      setMySelectedPokemon([]);
      setTheirSelectedPokemon([]);
      setCoinsOffered(0);
      setMessage('');
    }
  }, [isOpen, preselectedUserId]);

  const filteredUsers = usersData?.data.filter(
    u => u.id !== currentUser?.id &&
    u.displayName.toLowerCase().includes(userSearch.toLowerCase())
  ) || [];

  const toggleMyPokemon = (pokemon: Pokemon) => {
    if (mySelectedPokemon.find(p => p.id === pokemon.id)) {
      setMySelectedPokemon(prev => prev.filter(p => p.id !== pokemon.id));
    } else if (mySelectedPokemon.length < 6) {
      setMySelectedPokemon(prev => [...prev, pokemon]);
    }
  };

  const toggleTheirPokemon = (pokemon: Pokemon) => {
    if (theirSelectedPokemon.find(p => p.id === pokemon.id)) {
      setTheirSelectedPokemon(prev => prev.filter(p => p.id !== pokemon.id));
    } else if (theirSelectedPokemon.length < 6) {
      setTheirSelectedPokemon(prev => [...prev, pokemon]);
    }
  };

  const handleCreateTrade = async () => {
    if (!selectedUser || mySelectedPokemon.length === 0 || theirSelectedPokemon.length === 0) return;

    try {
      await createTrade.mutateAsync({
        receiverId: selectedUser.id,
        offeredPokemonIds: mySelectedPokemon.map(p => p.id),
        requestedPokemonIds: theirSelectedPokemon.map(p => p.id),
        coinsOffered: coinsOffered > 0 ? coinsOffered : undefined,
      });
      onClose();
    } catch (error: any) {
      alert(error.message || 'Failed to create trade');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">
            {step === 'select-user' && 'Select Trainer to Trade With'}
            {step === 'select-pokemon' && `Trade with ${selectedUser?.displayName}`}
            {step === 'confirm' && 'Confirm Trade'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
            ×
          </button>
        </div>

        {/* Step 1: Select User */}
        {step === 'select-user' && (
          <div className="flex-1 overflow-y-auto">
            <input
              type="text"
              placeholder="Search trainers..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="input w-full mb-4"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setStep('select-pokemon');
                  }}
                  className="card hover:ring-2 hover:ring-pokemon-electric transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{user.displayName[0].toUpperCase()}</span>
                      )}
                    </div>
                    <span className="font-bold truncate">{user.displayName}</span>
                  </div>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <p className="col-span-full text-center text-gray-400 py-8">No trainers found</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Pokemon */}
        {step === 'select-pokemon' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* My Pokemon */}
              <div className="flex flex-col overflow-hidden">
                <h3 className="font-bold mb-2 text-sm text-gray-400">
                  Your Pokemon ({mySelectedPokemon.length}/6 selected)
                </h3>
                <div className="flex-1 overflow-y-auto bg-gray-800/50 rounded-lg p-2">
                  <div className="grid grid-cols-3 gap-2">
                    {myPokemonData?.pokemon.map((p: Pokemon) => {
                      const isSelected = mySelectedPokemon.find(sp => sp.id === p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleMyPokemon(p)}
                          className={`p-2 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-pokemon-electric bg-pokemon-electric/20'
                              : `${RARITY_COLORS[p.species.rarity || 'common']} hover:bg-gray-700`
                          }`}
                        >
                          <div className="aspect-square bg-gray-700 rounded flex items-center justify-center">
                            <img
                              src={p.isShiny ? p.species.spriteShinyUrl : p.species.spriteUrl}
                              alt={p.species.name}
                              className="w-full h-full object-contain pixelated"
                            />
                          </div>
                          <p className="text-xs text-center mt-1 truncate capitalize">
                            {p.nickname || p.species.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Their Pokemon */}
              <div className="flex flex-col overflow-hidden">
                <h3 className="font-bold mb-2 text-sm text-gray-400">
                  {selectedUser?.displayName}'s Pokemon ({theirSelectedPokemon.length}/6 selected)
                </h3>
                <div className="flex-1 overflow-y-auto bg-gray-800/50 rounded-lg p-2">
                  <div className="grid grid-cols-3 gap-2">
                    {theirPokemonData?.data.map((p: Pokemon) => {
                      const isSelected = theirSelectedPokemon.find(sp => sp.id === p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleTheirPokemon(p)}
                          className={`p-2 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-pokemon-electric bg-pokemon-electric/20'
                              : `${RARITY_COLORS[p.species.rarity || 'common']} hover:bg-gray-700`
                          }`}
                        >
                          <div className="aspect-square bg-gray-700 rounded flex items-center justify-center">
                            <img
                              src={p.isShiny ? p.species.spriteShinyUrl : p.species.spriteUrl}
                              alt={p.species.name}
                              className="w-full h-full object-contain pixelated"
                            />
                          </div>
                          <p className="text-xs text-center mt-1 truncate capitalize">
                            {p.nickname || p.species.name}
                          </p>
                        </button>
                      );
                    })}
                    {theirPokemonData?.data.length === 0 && (
                      <p className="col-span-full text-center text-gray-400 py-8 text-sm">
                        No Pokemon available for trade
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Coins & Actions */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm text-gray-400">Add coins to offer:</label>
                <div className="flex items-center gap-2">
                  <span className="text-pokemon-electric">🪙</span>
                  <input
                    type="number"
                    min="0"
                    max={currentUser?.coins || 0}
                    value={coinsOffered}
                    onChange={e => setCoinsOffered(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input w-24"
                  />
                  <span className="text-xs text-gray-500">(max: {currentUser?.coins || 0})</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setStep('select-user');
                  }}
                  className="btn btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={mySelectedPokemon.length === 0 || theirSelectedPokemon.length === 0}
                  className="btn btn-primary flex-1"
                >
                  Review Trade
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* What you're giving */}
              <div>
                <h3 className="font-bold mb-3 text-pokemon-fire">You Give:</h3>
                <div className="space-y-2">
                  {mySelectedPokemon.map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                      <img
                        src={p.isShiny ? p.species.spriteShinyUrl : p.species.spriteUrl}
                        alt={p.species.name}
                        className="w-10 h-10 pixelated"
                      />
                      <span className="capitalize text-sm">
                        {p.isShiny && '✨ '}
                        {p.nickname || p.species.name}
                      </span>
                    </div>
                  ))}
                  {coinsOffered > 0 && (
                    <div className="flex items-center gap-2 bg-gray-700 rounded p-2">
                      <span className="text-pokemon-electric text-xl">🪙</span>
                      <span>{coinsOffered} coins</span>
                    </div>
                  )}
                </div>
              </div>

              {/* What you're getting */}
              <div>
                <h3 className="font-bold mb-3 text-pokemon-grass">You Get:</h3>
                <div className="space-y-2">
                  {theirSelectedPokemon.map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                      <img
                        src={p.isShiny ? p.species.spriteShinyUrl : p.species.spriteUrl}
                        alt={p.species.name}
                        className="w-10 h-10 pixelated"
                      />
                      <span className="capitalize text-sm">
                        {p.isShiny && '✨ '}
                        {p.nickname || p.species.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Optional message */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-2">Message (optional):</label>
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Add a message to your trade offer..."
                maxLength={200}
                className="input w-full"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('select-pokemon')} className="btn btn-secondary">
                Back
              </button>
              <button
                onClick={handleCreateTrade}
                disabled={createTrade.isPending}
                className="btn btn-primary flex-1"
              >
                {createTrade.isPending ? 'Creating...' : 'Send Trade Offer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
