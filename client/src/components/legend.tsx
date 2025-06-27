export default function Legend() {
  return (
    <div className="fixed bottom-6 left-6 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl p-4 opacity-100 transition-opacity duration-500 z-30">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Legend</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#FF69B4' }}></div>
          <span className="text-sm text-white">Artists</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#8A2BE2' }}></div>
          <span className="text-sm text-white">Producers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#00CED1' }}></div>
          <span className="text-sm text-white">Songwriters</span>
        </div>
      </div>
    </div>
  );
}
