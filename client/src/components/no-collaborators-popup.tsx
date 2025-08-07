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
      <DialogContent 
        className="sm:max-w-md bg-black/95 backdrop-blur-sm border-2 border-purple-500/30 text-white shadow-2xl" 
        style={{
          boxShadow: '0 0 20px rgba(180, 39, 180, 0.3)',
          borderColor: '#b427b4'
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-white">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/30">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <span>Warning: Potential Inaccuracies</span>
          </DialogTitle>
          <DialogDescription className="text-gray-300 mt-3 text-base">
            No documented collaborators were found for <span className="font-semibold text-white bg-purple-500/20 px-2 py-1 rounded">{artistName}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6">
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              We can generate a collaboration network that may include fictional or inaccurate information. 
              This is for exploration purposes only and should not be considered factual.
            </p>
          </div>
        </div>

        <DialogFooter className="flex justify-center">
          <Button
            onClick={handleShowHallucinations}
            disabled={isLoading}
            className="w-full h-12 text-white text-sm font-medium px-6 rounded-xl transition-all duration-200"
            style={{
              backgroundColor: '#b427b4',
              boxShadow: '0 4px 12px rgba(180, 39, 180, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#8f1c8f';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(180, 39, 180, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#b427b4';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(180, 39, 180, 0.3)';
            }}
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