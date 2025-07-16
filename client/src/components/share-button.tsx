import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Camera, Download } from "lucide-react";
import { useState } from "react";
import html2canvas from "html2canvas";

export default function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "The artist network link has been copied to your clipboard.",
        className: "bg-green-600 border-green-500 text-white",
      });
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast({
        title: "Copy failed",
        description: "Unable to copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const copyFromDialog = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied!",
        className: "bg-green-600 border-green-500 text-white",
      });
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast({
        title: "Copy failed",
        variant: "destructive",
      });
    }
  };

  const createWatermarkedSnapshot = async (): Promise<string> => {
    setIsCapturing(true);
    
    try {
      // Capture the entire page
      const canvas = await html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        useCORS: true,
        allowTaint: true,
        scale: 0.8, // Reduce scale for better performance
        logging: false,
      });

      // Create a new canvas for the watermarked image
      const watermarkedCanvas = document.createElement('canvas');
      const ctx = watermarkedCanvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Set canvas size to match the screenshot
      watermarkedCanvas.width = canvas.width;
      watermarkedCanvas.height = canvas.height;

      // Draw the screenshot onto the new canvas
      ctx.drawImage(canvas, 0, 0);

      // Load the Grapevine logo
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      
      return new Promise((resolve, reject) => {
        logo.onload = () => {
          try {
            // Calculate watermark size and position (top-left corner)
            const logoSize = Math.min(150, canvas.width * 0.15); // Max 150px or 15% of width
            const padding = 20;
            
            // Create a semi-transparent background for the watermark
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            const bgWidth = logoSize + 80;
            const bgHeight = logoSize + 20;
            const bgX = padding - 10;
            const bgY = padding - 10;
            
            // Use roundRect if available, otherwise use regular rect
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 10);
            } else {
              ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
            }
            ctx.fill();
            
            // Draw the logo
            ctx.drawImage(logo, padding, padding, logoSize, logoSize);
            
            // Add "Grapevine" text next to the logo
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(16, logoSize * 0.15)}px Arial, sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText('Grapevine', padding + logoSize + 10, padding + logoSize/2 + 6);
            
            // Convert to data URL
            const dataUrl = watermarkedCanvas.toDataURL('image/png', 0.9);
            setIsCapturing(false);
            resolve(dataUrl);
          } catch (error) {
            setIsCapturing(false);
            reject(error);
          }
        };
        
        logo.onerror = () => {
          // Fallback: just return the screenshot without watermark
          console.warn('Failed to load logo, returning screenshot without watermark');
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          setIsCapturing(false);
          resolve(dataUrl);
        };
        
        logo.src = '/grapevine-logo.png';
      });
    } catch (error) {
      setIsCapturing(false);
      console.error('Failed to create snapshot:', error);
      throw error;
    }
  };

  const downloadSnapshot = () => {
    if (!snapshotDataUrl) return;
    
    const link = document.createElement('a');
    link.download = `grapevine-network-${Date.now()}.png`;
    link.href = snapshotDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Downloaded!",
      description: "Network snapshot saved to your downloads.",
      className: "bg-green-600 border-green-500 text-white",
    });
  };

  const handleShareClick = async () => {
    const url = window.location.href;
    setCurrentUrl(url);
    
    // Copy to clipboard automatically when button is clicked
    await copyToClipboard(url);
    
    // Create snapshot
    try {
      const snapshot = await createWatermarkedSnapshot();
      setSnapshotDataUrl(snapshot);
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      toast({
        title: "Snapshot failed",
        description: "Unable to create page snapshot, but link was copied.",
        variant: "destructive",
      });
    }
    
    // Open the dialog to show the URL and snapshot
    setIsOpen(true);
  };

  return (
    <div className="fixed bottom-20 right-4 z-30">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 rounded-full shadow-lg"
                  onClick={handleShareClick}
                  disabled={isCapturing}
                >
                  {isCapturing ? (
                    <Camera className="w-6 h-6 animate-pulse" />
                  ) : (
                    <Share2 className="w-6 h-6" />
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    Share Artist Network
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white break-all">
                        {currentUrl}
                      </div>
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => copyFromDialog(currentUrl)}
                        className="bg-gray-700 hover:bg-gray-600 border-gray-600"
                        title="Copy link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Snapshot Section */}
                  {snapshotDataUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white">Network Snapshot</h4>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={downloadSnapshot}
                          className="bg-gray-700 hover:bg-gray-600 border-gray-600"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                      <div className="border border-gray-600 rounded overflow-hidden">
                        <img 
                          src={snapshotDataUrl} 
                          alt="Network snapshot" 
                          className="w-full max-h-96 object-contain bg-black"
                        />
                      </div>
                    </div>
                  )}
                  
                  {isCapturing && (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center space-x-2">
                        <Camera className="w-5 h-5 animate-pulse text-blue-400" />
                        <span className="text-sm text-gray-300">Creating snapshot...</span>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </TooltipTrigger>
          <TooltipContent>
            <p>Share this artist's network!</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
} 