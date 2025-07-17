import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import { useState } from "react";

export default function HelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 sm:bottom-4 right-4 z-30">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 rounded-full shadow-lg"
            title="Help"
          >
            <HelpCircle className="w-6 h-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">How To Use</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-4">
            <img 
              key={isOpen ? 'gif-playing' : 'gif-stopped'}
              src="/help-button.gif" 
              alt="Help instructions" 
              className="max-w-full max-h-96 rounded-lg border-2"
              style={{ borderColor: '#b427b4' }}
              loading="eager"
              decoding="async"
              onLoad={() => {
                console.log('Help GIF loaded successfully');
              }}
              onError={(e) => {
                console.error('Failed to load help GIF:', e);
                console.error('Current src:', (e.target as HTMLImageElement).src);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 