import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, User } from "lucide-react";

interface NoCollaboratorsPopupProps {
  isOpen: boolean;
  artistName: string;
  onClose: () => void;
  onShowHallucinations: () => void;
  onShowSingleNode: () => void;
}

export default function NoCollaboratorsPopup({
  isOpen,
  artistName,
  onClose,
  onShowHallucinations,
  onShowSingleNode,
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

  const handleShowSingleNode = () => {
    onShowSingleNode();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            No Collaborators Found
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            No documented collaborators were found for <span className="font-semibold text-white">{artistName}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-400 mb-4">
            Would you like to see a map with potential collaborations that may include inaccurate information, or just view the artist alone?
          </p>
        </div>

        <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={handleShowSingleNode}
            className="w-full sm:w-auto border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white text-sm"
            disabled={isLoading}
          >
            <User className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="whitespace-nowrap">Show Single Node</span>
          </Button>
          <Button
            onClick={handleShowHallucinations}
            disabled={isLoading}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white text-sm px-3"
          >
            <Users className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="whitespace-nowrap">
              {isLoading ? "Generating..." : "See Potential Collaborators"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 