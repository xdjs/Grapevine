import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users } from "lucide-react";

interface NoCollaboratorsPopupProps {
  isOpen: boolean;
  artistName: string;
  onClose: () => void;
  onShowHallucinations: () => void;
}

export default function NoCollaboratorsPopup({
  isOpen,
  artistName,
  onClose,
  onShowHallucinations,
}: NoCollaboratorsPopupProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleShowHallucinations = async () => {
    setIsLoading(true);
    try {
      await onShowHallucinations();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700 text-white" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Warning: Potential Inaccuracies
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            No documented collaborators were found for <span className="font-semibold text-white">{artistName}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-400 mb-4">
            We can generate a collaboration network that may include fictional or inaccurate information. This is for exploration purposes only and should not be considered factual.
          </p>
        </div>

        <DialogFooter className="flex justify-center">
          <Button
            onClick={handleShowHallucinations}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm px-6"
          >
            <Users className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="whitespace-nowrap">
              {isLoading ? "Generating..." : "Proceed with Hallucinations"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 