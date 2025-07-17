import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Minus, RotateCcw, X, Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { FilterState } from "@/types/network";

interface MobileControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearAll: () => void;
  filterState: FilterState;
  onFilterChange: (filterState: FilterState) => void;
}

export default function MobileControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClearAll,
  filterState,
  onFilterChange,
}: MobileControlsProps) {
  const [showControls, setShowControls] = useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <>
      {/* Mobile Control Toggle Button */}
      <Button
        onClick={() => setShowControls(!showControls)}
        className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
        size="icon"
      >
        <Settings className="w-5 h-5" />
      </Button>

      {/* Mobile Controls Panel */}
      {showControls && (
        <Card className="fixed bottom-20 right-4 z-40 bg-gray-900/95 backdrop-blur p-4 max-w-[calc(100vw-2rem)] border-2" style={{ borderColor: '#b427b4' }}>
          <div className="space-y-4">
            {/* Zoom Controls */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Zoom</h3>
              <div className="flex gap-2">
                <Button
                  onClick={onZoomIn}
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  In
                </Button>
                <Button
                  onClick={onZoomOut}
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600"
                >
                  <Minus className="w-4 h-4 mr-1" />
                  Out
                </Button>
                <Button
                  onClick={onZoomReset}
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset
                </Button>
              </div>
            </div>

            {/* Filter Controls */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Filters</h3>
              <div className="space-y-2">
                <Button
                  onClick={() => onFilterChange({ ...filterState, showArtists: !filterState.showArtists })}
                  size="sm"
                  variant={filterState.showArtists ? "default" : "secondary"}
                  className={`w-full ${filterState.showArtists ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-800 hover:bg-gray-700 border-gray-600'}`}
                >
                  Artists
                </Button>
                <Button
                  onClick={() => onFilterChange({ ...filterState, showProducers: !filterState.showProducers })}
                  size="sm"
                  variant={filterState.showProducers ? "default" : "secondary"}
                  className={`w-full ${filterState.showProducers ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-800 hover:bg-gray-700 border-gray-600'}`}
                >
                  Producers
                </Button>
                <Button
                  onClick={() => onFilterChange({ ...filterState, showSongwriters: !filterState.showSongwriters })}
                  size="sm"
                  variant={filterState.showSongwriters ? "default" : "secondary"}
                  className={`w-full ${filterState.showSongwriters ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 hover:bg-gray-700 border-gray-600'}`}
                >
                  Songwriters
                </Button>
              </div>
            </div>



            {/* Clear All */}
            <Button
              onClick={onClearAll}
              size="sm"
              variant="destructive"
              className="w-full bg-red-900/90 hover:bg-red-800 border-red-700"
            >
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </Card>
      )}

      {/* Background overlay to close controls - REMOVED FOR MOBILE */}
      {/* {showControls && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={() => setShowControls(false)}
        />
      )} */}
    </>
  );
}