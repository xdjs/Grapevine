import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export default function ZoomControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: ZoomControlsProps) {
  return (
    <div className="fixed top-6 right-6 flex flex-col gap-2 opacity-100 transition-opacity duration-500 z-30">
      <Button
        onClick={onZoomIn}
        size="icon"
        variant="secondary"
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
      >
        <Plus className="w-5 h-5" />
      </Button>
      <Button
        onClick={onZoomOut}
        size="icon"
        variant="secondary"
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
      >
        <Minus className="w-5 h-5" />
      </Button>
      <Button
        onClick={onZoomReset}
        size="icon"
        variant="secondary"
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
      >
        <RotateCcw className="w-5 h-5" />
      </Button>
    </div>
  );
}
