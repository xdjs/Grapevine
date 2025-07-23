import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Camera, Download, Facebook, Instagram } from "lucide-react";
import { useState } from "react";
import html2canvas from "html2canvas";
import * as d3 from "d3";

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

export default function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const { toast } = useToast();



  // Platform-specific share functions - direct URL sharing
  const shareToFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent("Check out this artist collaboration network! Discover how your favorite artists are connected.");
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  };
  
  const shareToInstagram = () => {
    // Instagram doesn't support direct URL sharing, so we'll copy to clipboard and open Instagram's posting interface
    const text = `🎵 Artist collaboration network 🎵\n\nDiscover music connections at ${window.location.href}\n\n#music #artists #collaboration #grapevine`;
    
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard!",
        description: "Caption copied. Opening Instagram - paste when creating your post.",
        className: "bg-green-600 border-green-500 text-white",
        duration: 1000,
      });
      
      // Try to open Instagram's posting interface directly
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
    const text = encodeURIComponent(`Check out this artist collaboration network! 🎵\n\nExplore music connections 👇\n\n#music #artists #collaboration`);
    const url = encodeURIComponent(window.location.href);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };
  
  const shareToPinterest = () => {
    const url = encodeURIComponent(window.location.href);
    const description = encodeURIComponent("Artist Collaboration Network - Discover how your favorite artists are connected! Explore music connections and collaborations.");
    // Pinterest doesn't support data URLs, so we'll share without the image
    const pinterestUrl = `https://pinterest.com/pin/create/button/?url=${url}&description=${description}`;
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
    let originalViewBox = '';
    let originalZoom = 1;
    let svg: SVGSVGElement | null = null;
    
    try {
      // Find the network container element
      const networkContainer = document.querySelector('.network-container') as HTMLElement;
      if (!networkContainer) {
        throw new Error('Network visualization not found');
      }

      // Save current zoom state
      svg = networkContainer.querySelector('svg') as SVGSVGElement;
      if (svg) {
        originalViewBox = svg.getAttribute('viewBox') || '';
        // Get current zoom level from the SVG transform or viewBox
        const currentViewBox = svg.getAttribute('viewBox');
        if (currentViewBox) {
          const [, , width, height] = currentViewBox.split(' ').map(Number);
          const containerWidth = networkContainer.clientWidth;
          originalZoom = containerWidth / width;
        }
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

      // Zoom out to fit entire network before capturing
      if (svg) {
        // Get all network nodes to calculate bounds
        const nodes = svg.querySelectorAll('.node-group');
        if (nodes.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          
          nodes.forEach((node) => {
            const transform = node.getAttribute('transform');
            if (transform) {
              const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
              if (match) {
                const x = parseFloat(match[1]);
                const y = parseFloat(match[2]);
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
              }
            }
          });
          
          // Check if we have valid bounds
          if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
            console.warn('Invalid network bounds, skipping zoom adjustment');
          } else {
            // Add generous padding around the network to ensure nothing is cut off
            const padding = 120; // Increased padding to account for text labels
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(networkContainer.clientWidth, maxX + padding);
            maxY = Math.min(networkContainer.clientHeight, maxY + padding);
            
            // Calculate the network dimensions
            const networkWidth = maxX - minX;
            const networkHeight = maxY - minY;
            const containerWidth = networkContainer.clientWidth;
            const containerHeight = networkContainer.clientHeight;
            
            // Only proceed if we have valid dimensions
            if (networkWidth > 0 && networkHeight > 0 && containerWidth > 0 && containerHeight > 0) {
              // Calculate zoom to fit the network with margin
              const zoomX = containerWidth / networkWidth;
              const zoomY = containerHeight / networkHeight;
              
              // Use the smaller zoom to ensure everything fits
              const fitZoom = Math.min(zoomX, zoomY);
              
              // Smart zoom logic:
              // - If fitZoom < 0.9: Network is too large, zoom out
              // - If fitZoom > 1.1: Network is too small, zoom in
              // - Otherwise: Network fits well, use current or slight adjustment
              let finalZoom;
              if (fitZoom < 0.9) {
                // Network is too large - zoom out to show everything
                finalZoom = fitZoom;
                console.log(`🔍 ZOOM OUT: Network too large, zooming out to ${finalZoom.toFixed(2)}x`);
              } else if (fitZoom > 1.1) {
                // Network is too small - zoom in to fill space better
                finalZoom = Math.min(fitZoom, 1.3); // Cap zoom in at 1.3x
                console.log(`🔍 ZOOM IN: Network too small, zooming in to ${finalZoom.toFixed(2)}x`);
              } else {
                // Network fits well - slight adjustment if needed
                finalZoom = Math.min(fitZoom, 1);
                console.log(`🔍 ZOOM FIT: Network fits well at ${finalZoom.toFixed(2)}x`);
              }
              
              // Apply the zoom to fit the entire network
              const newWidth = containerWidth / finalZoom;
              const newHeight = containerHeight / finalZoom;
              
              // Center the network in the viewport
              const networkCenterX = (minX + maxX) / 2;
              const networkCenterY = (minY + maxY) / 2;
              const offsetX = networkCenterX - (newWidth / 2);
              const offsetY = networkCenterY - (newHeight / 2);
              
              console.log(`🔍 ZOOM DEBUG: network=${networkWidth}x${networkHeight}, container=${containerWidth}x${containerHeight}, fitZoom=${fitZoom.toFixed(2)}, finalZoom=${finalZoom.toFixed(2)}`);
              
              // Apply the zoom transition
              const d3Svg = d3.select(svg);
              d3Svg.transition()
                .duration(400) // Slightly longer for smoother effect
                .attr('viewBox', `${offsetX} ${offsetY} ${newWidth} ${newHeight}`);
              
              // Wait for the zoom transition to complete
              await new Promise(resolve => setTimeout(resolve, 450));
            }
          }
        }
      }

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

      // Restore original zoom state
      if (svg && originalViewBox) {
        const d3Svg = d3.select(svg);
        d3Svg.transition()
          .duration(300)
          .attr('viewBox', originalViewBox);
      }

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
      
      // Restore original zoom state even if there's an error
      if (svg && originalViewBox) {
        const d3Svg = d3.select(svg);
        d3Svg.transition()
          .duration(300)
          .attr('viewBox', originalViewBox);
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
    <div className="fixed bottom-32 sm:bottom-20 right-4 z-30">
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
              <DialogContent className="w-[95vw] max-w-3xl h-[80vh] max-h-[500px] bg-gray-900 border-gray-700 p-4 sm:p-6">
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-white text-lg sm:text-xl">
                    Share Artist Network
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 h-full flex flex-col">
                  {/* URL Section - Compact */}
                  <div className="space-y-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white break-all">
                        {currentUrl}
                      </div>
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => copyFromDialog(currentUrl)}
                        className="bg-gray-700 hover:bg-gray-600 border-gray-600 flex-shrink-0"
                        title="Copy link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Snapshot Section - Takes up most of the space */}
                  {snapshotDataUrl && (
                    <div className="space-y-2 flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between flex-shrink-0">
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
                      <div className="border border-gray-600 rounded overflow-hidden flex-1 min-h-0 bg-black">
                        <img 
                          src={snapshotDataUrl} 
                          alt="Network snapshot" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Social Media Buttons - Compact at bottom */}
                  {snapshotDataUrl && (
                    <div className="space-y-2 flex-shrink-0">
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
                    <div className="flex items-center justify-center py-8 flex-shrink-0">
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