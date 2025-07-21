import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Camera, Download, Facebook, Instagram } from "lucide-react";
import { useState } from "react";
import html2canvas from "html2canvas";

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
    let originalDisplays: string[] = [];
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
      
      // Define spacing constants for consistent use - detect mobile for different sizing
      const isMobileForSpacing = window.innerWidth <= 768;
      const sidePadding = (isMobileForSpacing ? 60 : 40) * highScale; // More side padding on mobile for node names
      const bottomPadding = 20 * highScale; // Minimal bottom padding - tight crop at bottom
      const topWatermarkSpace = (isMobileForSpacing ? 120 : 80) * highScale; // Bigger watermark space on mobile
      
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
            
            // Add minimal padding around the network for tight fit (using predefined constants)
            minX = Math.max(0, minX - sidePadding);
            minY = Math.max(0, minY - topWatermarkSpace); // Extra space at top
            maxX = Math.min(canvas.width, maxX + sidePadding);
            maxY = Math.min(canvas.height, maxY + bottomPadding);
            
            networkBounds = { minX, minY, maxX, maxY };
          }
        } catch (error) {
          console.warn('Could not calculate network bounds:', error);
        }
      }

      // Calculate network dimensions
      const networkWidth = networkBounds.maxX - networkBounds.minX;
      const networkHeight = networkBounds.maxY - networkBounds.minY;
      
      // Detect mobile vs desktop for different crop formats
      const isMobile = window.innerWidth <= 768;
      
      let finalWidth, finalHeight;
      
      if (isMobile) {
        // Mobile: Use rectangle that fits mobile screen proportions (9:16 aspect ratio)
        const minSize = 320 * highScale;
        const mobileAspectRatio = 9 / 16; // width / height
        
        // Start with network dimensions and adjust to mobile aspect ratio
        let baseWidth = Math.max(minSize, networkWidth);
        let baseHeight = Math.max(minSize, networkHeight);
        
        // Adjust to mobile aspect ratio while encompassing the network
        if (baseWidth / baseHeight > mobileAspectRatio) {
          // Too wide, adjust height
          finalWidth = baseWidth;
          finalHeight = baseWidth / mobileAspectRatio;
        } else {
          // Too tall, adjust width
          finalHeight = baseHeight;
          finalWidth = baseHeight * mobileAspectRatio;
        }
        
        console.log(`📱 MOBILE DEBUG: networkWidth=${networkWidth}, networkHeight=${networkHeight}, finalWidth=${finalWidth}, finalHeight=${finalHeight}`);
      } else {
        // Desktop: Keep square format
        const minSize = 400 * highScale;
        const squareSize = Math.max(minSize, Math.max(networkWidth, networkHeight));
        finalWidth = squareSize;
        finalHeight = squareSize;
        
        console.log(`🔳 DESKTOP DEBUG: networkWidth=${networkWidth}, networkHeight=${networkHeight}, squareSize=${squareSize}`);
      }
      
      // Center the crop around the network center
      const networkCenterX = (networkBounds.minX + networkBounds.maxX) / 2;
      const networkCenterY = (networkBounds.minY + networkBounds.maxY) / 2;
      
      // Calculate crop coordinates
      const halfWidth = finalWidth / 2;
      const halfHeight = finalHeight / 2;
      const cropX = Math.max(0, Math.min(canvas.width - finalWidth, networkCenterX - halfWidth));
      const cropY = Math.max(0, Math.min(canvas.height - finalHeight, networkCenterY - halfHeight));

      // Create canvas with appropriate dimensions
      const watermarkedCanvas = document.createElement('canvas');
      const ctx = watermarkedCanvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Set canvas dimensions based on device type
      watermarkedCanvas.width = finalWidth;
      watermarkedCanvas.height = finalHeight;
      
      console.log(`📐 CANVAS DEBUG: width=${watermarkedCanvas.width}, height=${watermarkedCanvas.height}, isMobile=${isMobile}`);

      // Fill with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, finalWidth, finalHeight);

      // Draw the cropped image
      ctx.drawImage(
        canvas,
        cropX, cropY, finalWidth, finalHeight, // Source: crop from original
        0, 0, finalWidth, finalHeight // Destination: full new canvas
      );

      // Load the Grapevine logo
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      
      return new Promise((resolve, reject) => {
        logo.onload = () => {
          try {
            // Calculate watermark size and position - bigger on mobile
            const isMobileWatermark = window.innerWidth <= 768;
            const baseLogoSize = isMobileWatermark ? 80 : 60; // Bigger logo on mobile
            const logoSize = Math.min(baseLogoSize * highScale, Math.min(finalWidth, finalHeight) * (isMobileWatermark ? 0.12 : 0.08));
            const padding = (isMobileWatermark ? 16 : 12) * highScale; // More padding on mobile
            
            // Calculate dynamic text size based on logoSize - bigger on mobile
            const baseTextMultiplier = isMobileWatermark ? 0.35 : 0.3;
            const minTextSize = isMobileWatermark ? 14 : 10;
            const textSize = Math.max(minTextSize * highScale, logoSize * baseTextMultiplier);
            const textSpacing = (isMobileWatermark ? 8 : 6) * highScale;
            
            // Calculate watermark dimensions - adjust for mobile
            const bgWidth = logoSize + textSpacing + (textSize * 5.5); // Dynamic width based on text size
            const bgHeightPadding = isMobileWatermark ? 30 : 20; // More padding on mobile
            const bgHeight = logoSize + bgHeightPadding;
            
            // Position watermark in the top area that we reserved
            // Priority: top-left, top-right, then bottom corners as fallback
            const corners = [
              { x: padding - 10, y: padding - 10, name: 'top-left', priority: 1 }, // Top-left (highest priority)
              { x: finalWidth - bgWidth - padding + 10, y: padding - 10, name: 'top-right', priority: 2 }, // Top-right
              { x: padding - 10, y: finalHeight - bgHeight - padding + 10, name: 'bottom-left', priority: 3 }, // Bottom-left (fallback)
              { x: finalWidth - bgWidth - padding + 10, y: finalHeight - bgHeight - padding + 10, name: 'bottom-right', priority: 4 } // Bottom-right (fallback)
            ];
            
            // Calculate which corner has the least network content overlap
            let bestCorner = corners[0]; // Default to top-left
            let minScore = Infinity;
            
            // Calculate actual network content area in the cropped space
            // The network starts after the top watermark space we reserved
            const networkStartY = Math.max(0, topWatermarkSpace / highScale); // Convert back to crop scale
            
            // Check each corner for overlap with network area
            for (const corner of corners) {
              const watermarkRight = corner.x + bgWidth;
              const watermarkBottom = corner.y + bgHeight;
              
              // Calculate overlap with actual network content area (excluding top watermark space)
              const networkContentTop = networkStartY;
              const overlapLeft = Math.max(corner.x, 0);
              const overlapTop = Math.max(corner.y, networkContentTop);
              const overlapRight = Math.min(watermarkRight, finalWidth);
              const overlapBottom = Math.min(watermarkBottom, finalHeight);
              
              const overlapWidth = Math.max(0, overlapRight - overlapLeft);
              const overlapHeight = Math.max(0, overlapBottom - overlapTop);
              const overlapArea = overlapWidth * overlapHeight;
              
              // Heavily prioritize top positions since we reserved space there
              const priorityBonus = corner.priority * 1000; // Higher priority = lower score
              
              // Prefer corners in the reserved top space
              const isInTopSpace = corner.y + bgHeight <= networkStartY;
              const topSpaceBonus = isInTopSpace ? -5000 : 0; // Big bonus for fitting in top space
              
              // Combined score: overlap + priority + top space preference
              const score = overlapArea + priorityBonus + topSpaceBonus;
              
              if (score < minScore) {
                minScore = score;
                bestCorner = corner;
              }
            }
            
            console.log(`🎯 Watermark positioned at ${bestCorner.name} to avoid network overlap`);
            
            const bgX = bestCorner.x;
            const bgY = bestCorner.y;
            
            // Create a semi-transparent background for the watermark
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            
            // Use roundRect if available, otherwise use regular rect
            const cornerRadius = 6 * highScale;
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(bgX, bgY, bgWidth, bgHeight, cornerRadius);
            } else {
              ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
            }
            ctx.fill();
            
            // Draw the logo at the calculated position
            const logoX = bgX + 10; // Small offset from background edge
            const logoY = bgY + 10;
            ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
            
            // Add "Grapevine" text next to the logo
            ctx.fillStyle = 'white';
            ctx.font = `bold ${textSize}px Arial, sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText('Grapevine', logoX + logoSize + textSpacing, logoY + logoSize/2 + textSize/3);
            
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
          </TooltipTrigger>
          <TooltipContent>
            <p>Share this artist's network!</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
} 