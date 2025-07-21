import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Minus, RotateCcw, X, Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearAll: () => void;
}

export default function MobileControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClearAll,
}: MobileControlsProps) {
  const [showControls, setShowControls] = useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <>
      {/* Mobile Control Toggle Button */}
      <Button
        onClick={() => setShowControls(!showControls)}
        className="fixed right-4 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg mobile-controls"
        size="icon"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)'
        }}
      >
        <Settings className="w-5 h-5" />
      </Button>

      {/* Mobile Controls Panel */}
      {showControls && (
        <Card 
          className="fixed right-4 z-40 bg-gray-900/95 backdrop-blur p-4 max-w-[calc(100vw-2rem)] border-2 mobile-controls" 
          style={{ 
            borderColor: '#b427b4',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
            maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 120px)'
          }}
        >
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