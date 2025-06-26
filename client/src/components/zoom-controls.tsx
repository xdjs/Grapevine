import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw, X } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

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
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedZoom = useCallback((zoomFunction: () => void) => {
    if (isZooming) return; // Prevent rapid actions
    
    setIsZooming(true);
    
    // Clear any existing debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Execute zoom function
    zoomFunction();
    
    // Set debounce delay to prevent rapid actions
    debounceRef.current = setTimeout(() => {
      setIsZooming(false);
    }, 300); // 300ms debounce delay
  }, [isZooming]);

  const handleZoomIn = useCallback(() => {
    console.log('ZoomControls: Debounced zoom in triggered');
    debouncedZoom(onZoomIn);
  }, [onZoomIn, debouncedZoom]);

  const handleZoomOut = useCallback(() => {
    console.log('ZoomControls: Debounced zoom out triggered');
    debouncedZoom(onZoomOut);
  }, [onZoomOut, debouncedZoom]);

  const handleZoomReset = useCallback(() => {
    console.log('ZoomControls: Debounced zoom reset triggered');
    debouncedZoom(onZoomReset);
  }, [onZoomReset, debouncedZoom]);

  // Handle zoom completion events from network-visualizer
  useEffect(() => {
    const handleZoomComplete = (event: CustomEvent) => {
      console.log('ZoomControls: Received zoom-complete event', event.detail);
      // Reset the zooming state when transition is complete
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setIsZooming(false);
    };

    window.addEventListener('zoom-complete', handleZoomComplete as EventListener);
    
    return () => {
      window.removeEventListener('zoom-complete', handleZoomComplete as EventListener);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed top-6 right-6 flex flex-col gap-2 opacity-100 transition-opacity duration-500 z-30">
      <Button
        onClick={handleZoomIn}
        size="icon"
        variant="secondary"
        disabled={isZooming}
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 disabled:opacity-50"
        title="Zoom In"
      >
        <Plus className="w-5 h-5" />
      </Button>
      <Button
        onClick={handleZoomOut}
        size="icon"
        variant="secondary"
        disabled={isZooming}
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 disabled:opacity-50"
        title="Zoom Out"
      >
        <Minus className="w-5 h-5" />
      </Button>
      <Button
        onClick={handleZoomReset}
        size="icon"
        variant="secondary"
        disabled={isZooming}
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 disabled:opacity-50"
        title="Reset Zoom"
      >
        <RotateCcw className="w-5 h-5" />
      </Button>
      <div className="w-full h-px bg-gray-700 my-1"></div>
      <Button
        onClick={onClearAll}
        size="icon"
        variant="destructive"
        className="w-12 h-12 bg-red-900/90 backdrop-blur hover:bg-red-800 border border-red-700"
        title="Clear All"
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  );
}
