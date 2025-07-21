import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Minus,
  RotateCcw,
  X,
  Settings,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const [showControls, setShowControls] = useState(false); // existing zoom / clear panel
  const [showMenu, setShowMenu] = useState(false); // new three-dot options menu
  const { toast } = useToast();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <>
      {/* Options (three-dots) Toggle Button */}
      {!showMenu && (
        <Button
          onClick={() => setShowMenu(true)}
          className="fixed bottom-6 sm:bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
          size="icon"
          title="Options"
        >
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      )}

      {/* Options Menu */}
      {showMenu && (
        <div className="fixed bottom-24 sm:bottom-20 right-4 z-50 flex flex-col items-end gap-2">
          {/* Share Button */}
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 rounded-full shadow-lg"
            title="Share"
            onClick={async () => {
              try {
                if (navigator.share) {
                  await navigator.share({
                    title: document.title,
                    url: window.location.href,
                  });
                } else {
                  await navigator.clipboard.writeText(window.location.href);
                  toast({
                    title: "Link copied!",
                    className: "bg-green-600 border-green-500 text-white",
                    duration: 1000,
                  });
                }
              } catch (err) {
                console.error("Sharing failed", err);
              } finally {
                setShowMenu(false);
              }
            }}
          >
            <Share2 className="w-6 h-6" />
          </Button>

          {/* Settings Button – opens existing controls panel */}
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 rounded-full shadow-lg"
            title="Settings"
            onClick={() => {
              setShowControls(true);
              setShowMenu(false);
            }}
          >
            <Settings className="w-6 h-6" />
          </Button>

          {/* Close Button */}
          <Button
            size="icon"
            variant="destructive"
            className="w-12 h-12 bg-red-900/90 backdrop-blur hover:bg-red-800 border border-red-700 rounded-full shadow-lg"
            title="Close Menu"
            onClick={() => setShowMenu(false)}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Mobile Controls Panel */}
      {showControls && (
        <Card className="fixed bottom-24 sm:bottom-20 right-4 z-40 bg-gray-900/95 backdrop-blur p-4 max-w-[calc(100vw-2rem)] border-2" style={{ borderColor: '#b427b4' }}>
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