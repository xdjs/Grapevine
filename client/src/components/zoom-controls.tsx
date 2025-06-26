import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw, X } from "lucide-react";

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
  return (
    <div className="fixed top-6 right-6 flex flex-col gap-2 opacity-100 transition-opacity duration-500 z-30">
      <Button
        onClick={onZoomIn}
        size="icon"
        variant="secondary"
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
        title="Zoom In"
      >
        <Plus className="w-5 h-5" />
      </Button>
      <Button
        onClick={onZoomOut}
        size="icon"
        variant="secondary"
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
        title="Zoom Out"
      >
        <Minus className="w-5 h-5" />
      </Button>
      <Button
        onClick={onZoomReset}
        size="icon"
        variant="secondary"
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
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
