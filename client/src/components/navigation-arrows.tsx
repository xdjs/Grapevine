import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface NavigationArrowsProps {
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export default function NavigationArrows({ onMove }: NavigationArrowsProps) {
  return (
    <div className="fixed bottom-20 left-6 z-30">
      {/* Up arrow */}
      <div className="flex justify-center mb-2">
        <Button
          onClick={() => onMove('up')}
          size="icon"
          variant="secondary"
          className="w-10 h-10 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
          title="Move Up"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Left, Down, Right arrows */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onMove('left')}
          size="icon"
          variant="secondary"
          className="w-10 h-10 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
          title="Move Left"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <Button
          onClick={() => onMove('down')}
          size="icon"
          variant="secondary"
          className="w-10 h-10 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
          title="Move Down"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        
        <Button
          onClick={() => onMove('right')}
          size="icon"
          variant="secondary"
          className="w-10 h-10 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700"
          title="Move Right"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}