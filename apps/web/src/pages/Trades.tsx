export default function Trades() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trades</h1>
        <button className="btn btn-primary">
          New Trade
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button className="btn btn-primary">All</button>
        <button className="btn btn-secondary">Received</button>
        <button className="btn btn-secondary">Sent</button>
        <button className="btn btn-secondary">Completed</button>
      </div>

      {/* Empty State */}
      <div className="card text-center py-16">
        <div className="text-6xl mb-4">🔄</div>
        <h2 className="text-2xl font-bold mb-2">No Trades Yet</h2>
        <p className="text-gray-400 mb-4">
          Start a trade with another trainer!
        </p>
        <button className="btn btn-primary">
          Create Trade
        </button>
      </div>
    </div>
  );
}
