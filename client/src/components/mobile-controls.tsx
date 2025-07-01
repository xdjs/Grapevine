import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Minus, RotateCcw, X, Settings, Filter } from "lucide-react";
import { FilterState } from "@/types/network";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileControlsProps {
  filterState: FilterState;
  onFilterChange: (newState: FilterState) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearAll: () => void;
}

export default function MobileControls({
  filterState,
  onFilterChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClearAll,
}: MobileControlsProps) {
  const [showControls, setShowControls] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const handleFilterChange = (type: keyof FilterState, checked: boolean) => {
    onFilterChange({
      ...filterState,
      [type]: checked,
    });
  };

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
        <Card className="fixed bottom-20 right-4 z-40 bg-gray-900/95 backdrop-blur border-gray-700 p-4 max-w-[calc(100vw-2rem)]">
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

            {/* Filter Toggle */}
            <div>
              <Button
                onClick={() => setShowFilters(!showFilters)}
                size="sm"
                variant="outline"
                className="w-full bg-gray-800 hover:bg-gray-700 border-gray-600 text-white"
              >
                <Filter className="w-4 h-4 mr-2" />
                {showFilters ? "Hide Filters" : "Show Filters"}
              </Button>
              
              {showFilters && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mobile-showArtists"
                      checked={filterState.showArtists}
                      onCheckedChange={(checked) =>
                        handleFilterChange("showArtists", !!checked)
                      }
                      className="data-[state=checked]:border-[#FF0ACF] h-4 w-4"
                      style={{ backgroundColor: filterState.showArtists ? '#FF0ACF' : 'transparent' }}
                    />
                    <Label htmlFor="mobile-showArtists" className="text-xs text-white cursor-pointer flex items-center gap-1">
                      Artists
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF0ACF' }}></div>
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mobile-showProducers"
                      checked={filterState.showProducers}
                      onCheckedChange={(checked) =>
                        handleFilterChange("showProducers", !!checked)
                      }
                      className="data-[state=checked]:border-[#AE53FF] h-4 w-4"
                      style={{ backgroundColor: filterState.showProducers ? '#AE53FF' : 'transparent' }}
                    />
                    <Label htmlFor="mobile-showProducers" className="text-xs text-white cursor-pointer flex items-center gap-1">
                      Producers
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#AE53FF' }}></div>
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mobile-showSongwriters"
                      checked={filterState.showSongwriters}
                      onCheckedChange={(checked) =>
                        handleFilterChange("showSongwriters", !!checked)
                      }
                      className="data-[state=checked]:border-[#67D1F8] h-4 w-4"
                      style={{ backgroundColor: filterState.showSongwriters ? '#67D1F8' : 'transparent' }}
                    />
                    <Label htmlFor="mobile-showSongwriters" className="text-xs text-white cursor-pointer flex items-center gap-1">
                      Songwriters
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#67D1F8' }}></div>
                    </Label>
                  </div>
                </div>
              )}
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

      {/* Background overlay to close controls */}
      {showControls && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={() => setShowControls(false)}
        />
      )}
    </>
  );
}