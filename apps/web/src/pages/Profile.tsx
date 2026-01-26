export default function Profile() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">My Profile</h1>

      {/* Profile Card */}
      <div className="card">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center text-4xl">
            👤
          </div>
          <div>
            <h2 className="text-2xl font-bold">Trainer</h2>
            <p className="text-gray-400">trainer@example.com</p>
            <p className="text-pokemon-electric mt-2">500 🪙</p>
          </div>
        </div>
      </div>

      {/* My Team */}
      <div>
        <h2 className="text-2xl font-bold mb-4">My Team</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="card aspect-square flex items-center justify-center border-2 border-dashed border-gray-700"
            >
              <span className="text-gray-600 text-2xl">+</span>
            </div>
          ))}
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
            <div className="text-3xl font-bold">0</div>
            <div className="text-gray-400">Pokemon Owned</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold">0</div>
            <div className="text-gray-400">Pokedex Entries</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold">0</div>
            <div className="text-gray-400">Trades Done</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold">0</div>
            <div className="text-gray-400">Shinies</div>
          </div>
        </div>
      </div>
    </div>
  );
}
