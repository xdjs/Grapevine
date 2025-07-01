import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

interface RecenterButtonProps {
  onRecenter: () => void;
}

export default function RecenterButton({ onRecenter }: RecenterButtonProps) {
  return (
    <div className="fixed bottom-6 right-6 z-30">
      <Button
        onClick={onRecenter}
        size="icon"
        variant="secondary"
        className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 shadow-lg"
        title="Recenter on Main Artist"
      >
        <Target className="w-5 h-5" />
      </Button>
    </div>
  );
}