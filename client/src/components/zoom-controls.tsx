import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw, X } from "lucide-react";
import { useState, useRef, useCallback } from "react";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearAll: () => void;
}

export default function ZoomControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClearAll,
}: ZoomControlsProps) {
  const [isZooming, setIsZooming] = useState(false);
  const zoomIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMouseDownRef = useRef(false);

  const startContinuousZoom = useCallback((zoomFunction: () => void) => {
    if (zoomIntervalRef.current) return;
    
    // First zoom immediately
    zoomFunction();
    
    // Then start continuous zooming
    zoomIntervalRef.current = setInterval(() => {
      if (isMouseDownRef.current) {
        zoomFunction();
      }
    }, 100); // Zoom every 100ms while held
  }, []);

  const stopContinuousZoom = useCallback(() => {
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
    isMouseDownRef.current = false;
    setIsZooming(false);
  }, []);

  const handleZoomInStart = useCallback(() => {
    isMouseDownRef.current = true;
    setIsZooming(true);
    startContinuousZoom(onZoomIn);
  }, [onZoomIn, startContinuousZoom]);

  const handleZoomOutStart = useCallback(() => {
    isMouseDownRef.current = true;
    setIsZooming(true);
    startContinuousZoom(onZoomOut);
  }, [onZoomOut, startContinuousZoom]);

  const handleZoomReset = () => {
    setIsZooming(true);
    onZoomReset();
    setTimeout(() => setIsZooming(false), 500);
  };

  return (
    <div className="fixed top-16 sm:top-20 right-2 sm:right-6 flex flex-col gap-1 sm:gap-2 opacity-100 transition-opacity duration-500 z-30">
      <Button
        onMouseDown={handleZoomInStart}
        onMouseUp={stopContinuousZoom}
        onMouseLeave={stopContinuousZoom}
        size="icon"
        variant="secondary"
        disabled={isZooming}
        className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 disabled:opacity-50"
        title="Zoom In (Hold to continuous zoom)"
      >
        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
      </Button>
      <Button
        onMouseDown={handleZoomOutStart}
        onMouseUp={stopContinuousZoom}
        onMouseLeave={stopContinuousZoom}
        size="icon"
        variant="secondary"
        disabled={isZooming}
        className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 disabled:opacity-50"
        title="Zoom Out (Hold to continuous zoom)"
      >
        <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
      </Button>
      <Button
        onClick={handleZoomReset}
        size="icon"
        variant="secondary"
        disabled={isZooming}
        className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 disabled:opacity-50"
        title="Reset Zoom"
      >
        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
      </Button>
      <div className="w-full h-px bg-gray-700 my-1"></div>
      <Button
        onClick={onClearAll}
        size="icon"
        variant="destructive"
        className="w-10 h-10 sm:w-12 sm:h-12 bg-red-900/90 backdrop-blur hover:bg-red-800 border border-red-700"
        title="Clear All"
      >
        <X className="w-4 h-4 sm:w-5 sm:h-5" />
      </Button>
    </div>
  );
}
