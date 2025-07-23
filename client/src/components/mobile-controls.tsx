import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NetworkData, NetworkNode } from "@/types/network";
import {
  Plus,
  Minus,
  RotateCcw,
  X,
  Settings,
  MoreHorizontal,
  Share2,
  HelpCircle,
  Copy,
  Camera,
  Download,
  Facebook,
  Instagram,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

// Interface for artist social media data
interface ArtistSocialData {
  artistId: string;
  name: string;
  twitterUsername?: string | null;
  instagramUsername?: string | null;
  facebookUsername?: string | null;
}

// Custom SVG icons for social media platforms
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const PinterestIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.111.222.082.343-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.758-1.378l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001 12.017.001z"/>
  </svg>
);

interface MobileControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearAll: () => void;
  networkData?: NetworkData | null;
}

export default function MobileControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClearAll,
  networkData,
}: MobileControlsProps) {
  const [showControls, setShowControls] = useState(false); // existing zoom / clear panel
  const [showMenu, setShowMenu] = useState(false); // new three-dot options menu
  const [showHelp, setShowHelp] = useState(false); // help dialog state
  const [isOpen, setIsOpen] = useState(false); // share dialog state
  const [currentUrl, setCurrentUrl] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [artistSocialData, setArtistSocialData] = useState<ArtistSocialData | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch artist social media data when network data changes
  useEffect(() => {
    const fetchArtistSocialData = async () => {
      if (!networkData || !networkData.nodes) {
        setArtistSocialData(null);
        return;
      }

      // Find the main artist (the one with size 30)
      const mainArtist = networkData.nodes.find((node: NetworkNode) => 
        node.size === 30 && node.type === 'artist'
      );

      if (!mainArtist || !mainArtist.artistId) {
        setArtistSocialData(null);
        return;
      }

      try {
        console.log(`🔍 [MobileControls] Fetching social media data for artist ID: ${mainArtist.artistId}`);
        const response = await fetch(`/api/artist-social/${mainArtist.artistId}`);
        
        if (response.ok) {
          const socialData = await response.json();
          setArtistSocialData(socialData);
          console.log(`✅ [MobileControls] Found social media data for ${socialData.name}:`, socialData);
        } else {
          console.log(`❌ [MobileControls] No social media data found for artist ID: ${mainArtist.artistId}`);
          setArtistSocialData(null);
        }
      } catch (error) {
        console.error('Error fetching artist social media data:', error);
        setArtistSocialData(null);
      }
    };

    fetchArtistSocialData();
  }, [networkData]);

  if (!isMobile) return null;

  // Platform-specific share functions - direct URL sharing
  const shareToFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    let text = "Check out this artist collaboration network! Discover how your favorite artists are connected.";
    
    // Add artist tag if available
    if (artistSocialData && artistSocialData.facebookUsername) {
      text = `Check out ${artistSocialData.name}'s collaboration network! Tag: @${artistSocialData.facebookUsername} Discover how your favorite artists are connected.`;
    } else if (artistSocialData) {
      text = `Check out ${artistSocialData.name}'s collaboration network! Discover how your favorite artists are connected.`;
    }
    
    const encodedText = encodeURIComponent(text);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodedText}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  };
  
  const shareToInstagram = () => {
    // Instagram doesn't support direct URL sharing, so we'll copy to clipboard and open Instagram's posting interface
    let text = `🎵 Artist collaboration network 🎵\n\nDiscover music connections at ${window.location.href}\n\n#music #artists #collaboration #grapevine`;
    
    // Add artist tag if available
    if (artistSocialData && artistSocialData.instagramUsername) {
      text = `🎵 ${artistSocialData.name}'s collaboration network 🎵\n\nTag: @${artistSocialData.instagramUsername}\n\nDiscover music connections at ${window.location.href}\n\n#music #artists #collaboration #grapevine`;
    } else if (artistSocialData) {
      text = `🎵 ${artistSocialData.name}'s collaboration network 🎵\n\nDiscover music connections at ${window.location.href}\n\n#music #artists #collaboration #grapevine`;
    }
    
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard!",
        description: "Caption copied. Opening Instagram - paste when creating your post.",
        className: "bg-green-600 border-green-500 text-white",
        duration: 1000,
      });
      
      // Try to open Instagram app's camera/posting interface
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Try to open Instagram app's camera/posting interface
        const instagramAppUrl = 'instagram://camera';
        const fallbackUrl = 'https://www.instagram.com/';
        
        // Create a hidden iframe to test if the app opens
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = instagramAppUrl;
        document.body.appendChild(iframe);
        
        // If app doesn't open within 2 seconds, open web version
        setTimeout(() => {
          document.body.removeChild(iframe);
          window.open(fallbackUrl, '_blank');
        }, 2000);
        
        // Try to open the app immediately
        window.location.href = instagramAppUrl;
        
        // If we're still here after 500ms, the app probably didn't open
        setTimeout(() => {
          window.open(fallbackUrl, '_blank');
        }, 500);
             } else {
         // On desktop, open Instagram homepage
         window.open('https://www.instagram.com/', '_blank');
       }
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Unable to copy caption. Opening Instagram anyway.",
        variant: "destructive",
        duration: 1000,
      });
      
      // Fallback without clipboard - still try to open posting interface
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        window.open('instagram://camera', '_blank');
        setTimeout(() => {
          window.open('https://www.instagram.com/', '_blank');
        }, 1000);
             } else {
         window.open('https://www.instagram.com/', '_blank');
       }
    });
  };
  
  const shareToX = () => {
    let text = `Check out this artist collaboration network! 🎵\n\nExplore music connections 👇\n\n#music #artists #collaboration`;
    
    // Add artist tag if available
    if (artistSocialData && artistSocialData.twitterUsername) {
      text = `Check out ${artistSocialData.name}'s collaboration network! 🎵\n\n@${artistSocialData.twitterUsername}\n\nExplore music connections 👇\n\n#music #artists #collaboration`;
    } else if (artistSocialData) {
      text = `Check out ${artistSocialData.name}'s collaboration network! 🎵\n\nExplore music connections 👇\n\n#music #artists #collaboration`;
    }
    
    const encodedText = encodeURIComponent(text);
    const url = encodeURIComponent(window.location.href);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${url}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };
  
  const shareToPinterest = () => {
    const url = encodeURIComponent(window.location.href);
    let description = "Artist Collaboration Network - Discover how your favorite artists are connected! Explore music connections and collaborations.";
    
    // Add artist information if available
    if (artistSocialData) {
      description = `${artistSocialData.name}'s Collaboration Network - Discover how your favorite artists are connected! Explore music connections and collaborations.`;
    }
    
    const encodedDescription = encodeURIComponent(description);
    // Pinterest doesn't support data URLs, so we'll share without the image
    const pinterestUrl = `https://pinterest.com/pin/create/button/?url=${url}&description=${encodedDescription}`;
    window.open(pinterestUrl, '_blank', 'width=600,height=400');
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "The artist network link has been copied to your clipboard.",
        className: "bg-green-600 border-green-500 text-white",
        duration: 1000,
      });
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast({
        title: "Copy failed",
        description: "Unable to copy link to clipboard.",
        variant: "destructive",
        duration: 1000,
      });
    }
  };

  const copyFromDialog = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied!",
        className: "bg-green-600 border-green-500 text-white",
        duration: 1000,
      });
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast({
        title: "Copy failed",
        variant: "destructive",
        duration: 1000,
      });
    }
  };

  const createWatermarkedSnapshot = async (): Promise<string> => {
    setIsCapturing(true);
    
    // Declare variables at function scope for error handling
    let elementsToHide: HTMLElement[] = [];
    const originalDisplays: string[] = [];
    let currentDialog: HTMLElement | null = null;
    let dialogDisplay = '';
    
    try {
      // Find the network container element
      const networkContainer = document.querySelector('.network-container') as HTMLElement;
      if (!networkContainer) {
        throw new Error('Network visualization not found');
      }

      // Temporarily hide UI controls but keep the current share dialog
      currentDialog = document.querySelector('[data-state="open"][role="dialog"]') as HTMLElement;
      const controls = document.querySelectorAll('.fixed:not([role="dialog"]):not([data-radix-portal])') as NodeListOf<HTMLElement>;
      const tooltips = document.querySelectorAll('[data-radix-tooltip-content]') as NodeListOf<HTMLElement>;
      const searchBar = document.querySelector('.absolute.top-0') as HTMLElement;
      
      // Store original display values
      elementsToHide = [...Array.from(controls), ...Array.from(tooltips), searchBar].filter(Boolean) as HTMLElement[];
      
      // Hide current dialog temporarily during capture
      if (currentDialog) {
        dialogDisplay = currentDialog.style.display;
        currentDialog.style.display = 'none';
      }
      
      elementsToHide.forEach((element, index) => {
        if (element) {
          originalDisplays[index] = element.style.display;
          element.style.display = 'none';
        }
      });

      // Wait a brief moment for elements to hide
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture only the network visualization at high quality
      const devicePixelRatio = window.devicePixelRatio || 1;
      const highScale = Math.max(2, devicePixelRatio); // At least 2x, or device pixel ratio
      
      const canvas = await html2canvas(networkContainer, {
        useCORS: true,
        allowTaint: true,
        scale: highScale, // High resolution for crisp quality
        logging: false,
        backgroundColor: '#000000', // Ensure black background
        width: networkContainer.offsetWidth,
        height: networkContainer.offsetHeight,
      });

      // Restore original display values
      elementsToHide.forEach((element, index) => {
        if (element) {
          element.style.display = originalDisplays[index] || '';
        }
      });
      
      // Restore dialog
      if (currentDialog) {
        currentDialog.style.display = dialogDisplay;
      }

      // Find the bounds of the network content by analyzing the SVG
      const svg = networkContainer.querySelector('svg');
      let networkBounds = { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height };
      
      if (svg) {
        try {
          // Get all network nodes and their positions
          const nodes = svg.querySelectorAll('.node-group');
          if (nodes.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
                          nodes.forEach((node) => {
                const transform = node.getAttribute('transform');
                if (transform) {
                  const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                  if (match) {
                    // Scale the node positions to match the high-resolution canvas
                    const x = parseFloat(match[1]) * highScale;
                    const y = parseFloat(match[2]) * highScale;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                  }
                }
              });
            
            // Add padding around the network (scaled for high resolution)
            const padding = 80 * highScale;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(canvas.width, maxX + padding);
            maxY = Math.min(canvas.height, maxY + padding);
            
            networkBounds = { minX, minY, maxX, maxY };
          }
        } catch (error) {
          console.warn('Could not calculate network bounds:', error);
        }
      }

      // Calculate network dimensions
      const networkWidth = networkBounds.maxX - networkBounds.minX;
      const networkHeight = networkBounds.maxY - networkBounds.minY;
      
      // FORCE a perfect square - use the larger dimension for BOTH width and height
      // Ensure minimum size (scaled for high resolution)
      const minSize = 400 * highScale;
      const squareSize = Math.max(minSize, Math.max(networkWidth, networkHeight));
      
      console.log(`🔳 SQUARE DEBUG: networkWidth=${networkWidth}, networkHeight=${networkHeight}, squareSize=${squareSize}`);
      
      // Center the square crop around the network center
      const networkCenterX = (networkBounds.minX + networkBounds.maxX) / 2;
      const networkCenterY = (networkBounds.minY + networkBounds.maxY) / 2;
      
      // Calculate square crop coordinates - FORCE square dimensions
      const halfSquare = squareSize / 2;
      const cropX = Math.max(0, Math.min(canvas.width - squareSize, networkCenterX - halfSquare));
      const cropY = Math.max(0, Math.min(canvas.height - squareSize, networkCenterY - halfSquare));

      // Create a PERFECTLY SQUARE canvas
      const watermarkedCanvas = document.createElement('canvas');
      const ctx = watermarkedCanvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // FORCE the canvas to be perfectly square - width MUST equal height
      watermarkedCanvas.width = squareSize;
      watermarkedCanvas.height = squareSize;
      
      console.log(`🔳 CANVAS DEBUG: width=${watermarkedCanvas.width}, height=${watermarkedCanvas.height}, isSquare=${watermarkedCanvas.width === watermarkedCanvas.height}`);

      // Fill with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, squareSize, squareSize);

      // Draw EXACTLY a square crop - source and destination are both perfect squares
      ctx.drawImage(
        canvas,
        cropX, cropY, squareSize, squareSize, // Source: SQUARE crop from original
        0, 0, squareSize, squareSize // Destination: SQUARE on new canvas
      );

      // Load the Grapevine logo
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      
      return new Promise((resolve, reject) => {
        logo.onload = () => {
          try {
            // Calculate watermark size and position (top-left corner) - scaled for high res
            const logoSize = Math.min(60 * highScale, squareSize * 0.08);
            const padding = 12 * highScale;
            
            // Calculate dynamic text size based on logoSize
            const textSize = Math.max(10 * highScale, logoSize * 0.3);
            const textSpacing = 6 * highScale;
            
            // Create a semi-transparent background for the watermark
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            const bgWidth = logoSize + textSpacing + (textSize * 5.5); // Dynamic width based on text size
            const bgHeight = logoSize + 20;
            const bgX = padding - 10;
            const bgY = padding - 10;
            
            // Use roundRect if available, otherwise use regular rect
            const cornerRadius = 6 * highScale;
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(bgX, bgY, bgWidth, bgHeight, cornerRadius);
            } else {
              ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
            }
            ctx.fill();
            
            // Draw the logo
            ctx.drawImage(logo, padding, padding, logoSize, logoSize);
            
            // Add "Grapevine" text next to the logo
            ctx.fillStyle = 'white';
            ctx.font = `bold ${textSize}px Arial, sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText('Grapevine', padding + logoSize + textSpacing, padding + logoSize/2 + textSize/3);
            
            // Convert to high-quality PNG (1.0 = maximum quality)
            const dataUrl = watermarkedCanvas.toDataURL('image/png', 1.0);
            
            console.log(`🔳 HIGH-RES DEBUG: Canvas ${watermarkedCanvas.width}x${watermarkedCanvas.height}, Scale: ${highScale}x, DataURL length: ${dataUrl.length}`);
            
            setIsCapturing(false);
            resolve(dataUrl);
          } catch (error) {
            setIsCapturing(false);
            reject(error);
          }
        };
        
        logo.onerror = () => {
          // Fallback: just return the high-res cropped screenshot without watermark
          console.warn('Failed to load logo, returning high-res screenshot without watermark');
          const dataUrl = watermarkedCanvas.toDataURL('image/png', 1.0);
          setIsCapturing(false);
          resolve(dataUrl);
        };
        
        logo.src = '/grapevine-logo.png';
      });
    } catch (error) {
      // Ensure we restore elements even if there's an error
      elementsToHide.forEach((element, index) => {
        if (element) {
          element.style.display = originalDisplays[index] || '';
        }
      });
      
      if (currentDialog) {
        currentDialog.style.display = dialogDisplay;
      }
      
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
        duration: 1000,
    });
  };

  const handleShareClick = async () => {
    const url = window.location.href;
    setCurrentUrl(url);
    
    // Copy to clipboard automatically when button is clicked
    await copyToClipboard(url);
    
    // Open the dialog first
    setIsOpen(true);
    
    // Close the options menu
    setShowMenu(false);
    
    // Create snapshot after dialog is open
    try {
      const snapshot = await createWatermarkedSnapshot();
      setSnapshotDataUrl(snapshot);
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      toast({
        title: "Snapshot failed",
        description: "Unable to create page snapshot, but link was copied.",
        variant: "destructive",
        duration: 1000,
      });
    }
  };

  return (
    <>
      {/* Options (three-dots) Toggle Button */}
      {!showMenu && (
        <Button
          onClick={() => setShowMenu(true)}
          className="fixed bottom-6 sm:bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
          size="icon"
          title="Options"
        >
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      )}

      {/* Options Menu */}
      {showMenu && (
        <div className="fixed bottom-24 sm:bottom-20 right-4 z-50 flex flex-col items-end gap-2">
          {/* Share Button */}
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 rounded-full shadow-lg"
            title="Share"
            onClick={handleShareClick}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <Camera className="w-6 h-6 animate-pulse" />
            ) : (
              <Share2 className="w-6 h-6" />
            )}
          </Button>

          {/* Settings Button – opens existing controls panel */}
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 rounded-full shadow-lg"
            title="Settings"
            onClick={() => {
              setShowControls(true);
              setShowMenu(false);
            }}
          >
            <Settings className="w-6 h-6" />
          </Button>

          {/* Help Button */}
          <Button
            size="icon"
            variant="secondary"
            className="w-12 h-12 bg-gray-900/90 backdrop-blur hover:bg-gray-800 border border-gray-700 rounded-full shadow-lg"
            title="Help"
            onClick={() => {
              setShowHelp(true);
              setShowMenu(false);
            }}
          >
            <HelpCircle className="w-6 h-6" />
          </Button>

          {/* Close Button */}
          <Button
            size="icon"
            variant="destructive"
            className="w-12 h-12 bg-red-900/90 backdrop-blur hover:bg-red-800 border border-red-700 rounded-full shadow-lg"
            title="Close Menu"
            onClick={() => setShowMenu(false)}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Mobile Controls Panel */}
      {showControls && (
        <Card className="fixed bottom-6 sm:bottom-4 left-4 z-50 bg-gray-900/95 backdrop-blur p-3 max-w-[calc(100vw-2rem)] border-2" style={{ borderColor: '#b427b4' }}>
          {/* Close Button in Corner */}
          <Button
            onClick={() => setShowControls(false)}
            size="icon"
            variant="ghost"
            className="absolute top-1 right-1 w-5 h-5 bg-gray-800/50 hover:bg-gray-700/50 rounded-full"
          >
            <X className="w-3 h-3" />
          </Button>
          
          <div className="space-y-3">
            {/* Zoom Controls */}
            <div>
              <h3 className="text-xs font-semibold text-white mb-1">Zoom</h3>
              <div className="flex gap-1">
                <Button
                  onClick={onZoomIn}
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600 text-xs px-2 py-1"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  In
                </Button>
                <Button
                  onClick={onZoomOut}
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600 text-xs px-2 py-1"
                >
                  <Minus className="w-3 h-3 mr-1" />
                  Out
                </Button>
                <Button
                  onClick={onZoomReset}
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600 text-xs px-2 py-1"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
            </div>



            {/* Clear All */}
            <Button
              onClick={onClearAll}
              size="sm"
              variant="destructive"
              className="w-full bg-red-900/90 hover:bg-red-800 border-red-700 text-xs px-2 py-1"
            >
              <X className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          </div>
        </Card>
      )}

      {/* Background overlay to close controls */}
      {showControls && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={() => setShowControls(false)}
        />
      )}

      {/* Share Dialog - Outside options menu */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
            
            {/* Social Media Buttons */}
            {snapshotDataUrl && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white">Share on Social Media</h4>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="w-10 h-10 bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                    title="Share on Facebook"
                    onClick={shareToFacebook}
                  >
                    <Facebook className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 border-transparent text-white"
                    title="Share on Instagram"
                    onClick={shareToInstagram}
                  >
                    <Instagram className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="w-10 h-10 bg-black hover:bg-gray-900 border-gray-600 text-white"
                    title="Share on X"
                    onClick={shareToX}
                  >
                    <XIcon className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="w-10 h-10 bg-red-600 hover:bg-red-700 border-red-600 text-white"
                    title="Share on Pinterest"
                    onClick={shareToPinterest}
                  >
                    <PinterestIcon className="h-5 w-5" />
                  </Button>
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

      {/* Help Dialog - Outside options menu */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">How To Use</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-4">
            <img 
              key={showHelp ? 'gif-playing' : 'gif-stopped'}
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
    </>
  );
}