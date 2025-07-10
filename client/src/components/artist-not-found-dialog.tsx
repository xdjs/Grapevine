import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface ArtistNotFoundDialogProps {
  isOpen: boolean;
  onClose: () => void;
  artistName: string;
  baseUrl: string;
}

export default function ArtistNotFoundDialog({
  isOpen,
  onClose,
  artistName,
  baseUrl,
}: ArtistNotFoundDialogProps) {
  const handleVisitMusicNerd = () => {
    window.open(baseUrl, '_blank');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Artist Not Found
          </DialogTitle>
          <DialogDescription className="text-left">
            <strong>{artistName}</strong> has not been added to our database yet - feel free to add them and their socials!
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleVisitMusicNerd} className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Visit MusicNerd
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}