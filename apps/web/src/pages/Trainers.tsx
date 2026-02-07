import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUsers } from '../hooks/useApi';

export default function Trainers() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUsers({ page });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pokemon-electric"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trainers</h1>
        <p className="text-gray-400 mt-1">
          Browse all trainers and check out their teams
        </p>
      </div>

      {data?.data.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">No trainers found</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data?.data.map((user) => (
              <Link
                key={user.id}
                to={`/user/${user.id}`}
                className="card hover:ring-2 hover:ring-pokemon-electric transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">👤</span>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-lg truncate">{user.displayName}</h3>
                    <p className="text-gray-400 text-sm">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 mt-4 pt-4 border-t border-gray-700">
                  <div className="text-center flex-1">
                    <div className="text-xl font-bold">{user.stats.totalPokemon}</div>
                    <div className="text-xs text-gray-400">Pokemon</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-xl font-bold">{user.stats.pokedexCount}</div>
                    <div className="text-xs text-gray-400">Pokedex</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="flex items-center px-4 text-gray-400">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="btn btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
