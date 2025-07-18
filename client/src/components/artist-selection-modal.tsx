import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ArtistOption {
  id: string;
  artistId?: string;
  name: string;
  bio?: string;
}

interface ArtistSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistName: string;
  onSelectArtist: (artistId: string) => void;
}

export default function ArtistSelectionModal({
  isOpen,
  onClose,
  artistName,
  onSelectArtist,
}: ArtistSelectionModalProps) {
  const [options, setOptions] = useState<ArtistOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [musicNerdBaseUrl, setMusicNerdBaseUrl] = useState("");

  // Fetch configuration on component mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          if (config.musicNerdBaseUrl) {
            setMusicNerdBaseUrl(config.musicNerdBaseUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      }
    };
    
    fetchConfig();
  }, []);

  useEffect(() => {
    if (isOpen && artistName) {
      fetchArtistOptions();
    }
  }, [isOpen, artistName]);

  const fetchArtistOptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/artist-options/${encodeURIComponent(artistName)}`);
      const data = await response.json();
      setOptions(data.options || []);
    } catch (error) {
      console.error('Error fetching artist options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectArtist = (artistId: string) => {
    onSelectArtist(artistId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Multiple Artists Found</DialogTitle>
          <DialogDescription>
            We found multiple artists named "{artistName}". Please select the one you're looking for:
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading artist options...</div>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {options.map((option, index) => (
                <Card
                  key={option.id}
                  className="cursor-pointer hover:bg-accent transition-colors border-l-4"
                  style={{
                    borderLeftColor: '#FF69B4'
                  }}
                  onClick={() => handleSelectArtist(option.artistId || option.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{option.name}</CardTitle>
                      {option.name.toLowerCase() === artistName.toLowerCase() && (
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                          Exact Match
                        </span>
                      )}
                    </div>
                    {option.bio && (
                      <CardDescription className="text-sm line-clamp-2">
                        {option.bio}
                      </CardDescription>
                    )}
                  </CardHeader>
                </Card>
              ))}
              
              {options.length === 0 && !loading && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No artist options found in the database
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}