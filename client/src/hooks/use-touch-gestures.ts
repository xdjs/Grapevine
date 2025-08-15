import { useCallback, useEffect, useRef } from "react";

interface TouchGesturesProps {
  svgRef: React.RefObject<SVGSVGElement>;
  visible: boolean;
  onPinchZoomIn: (focalX: number, focalY: number) => void;
  onPinchZoomOut: (focalX: number, focalY: number) => void;
}

interface TouchGesturesReturn {
  setupTouchHandlers: () => (() => void) | undefined;
}

export function useTouchGestures({ 
  svgRef, 
  visible, 
  onPinchZoomIn, 
  onPinchZoomOut 
}: TouchGesturesProps): TouchGesturesReturn {
  
  // Setup touch and wheel event handlers
  const setupTouchHandlers = useCallback(() => {
    if (!svgRef.current) return;

    // Pinch zoom variables
    let initialDistance = 0;
    let lastScale = 1;
    let isPinching = false;
    const pinchThreshold = 2.0; // Much less sensitive - requires very deliberate pinch movement
    let pinchCenterX = 0;
    let pinchCenterY = 0;

    // Custom touch event handlers using existing zoom functions
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        console.log("🤏 Starting pinch gesture");
        isPinching = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calculate initial distance and center point
        initialDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // Store the center point of the pinch gesture
        pinchCenterX = (touch1.clientX + touch2.clientX) / 2;
        pinchCenterY = (touch1.clientY + touch2.clientY) / 2;
        
        lastScale = 1;
        event.preventDefault();
        event.stopPropagation();
      } else if (event.touches.length === 1) {
        event.preventDefault();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (isPinching && event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // Update the center point of the pinch gesture
        const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
        const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
        
        if (initialDistance > 0) {
          const scaleChange = currentDistance / initialDistance;
          
          // Use threshold to prevent too frequent updates
          if (Math.abs(scaleChange - lastScale) > pinchThreshold) {
            if (scaleChange > lastScale) {
              // Pinch out - zoom in using focal point
              onPinchZoomIn(currentCenterX, currentCenterY);
            } else {
              // Pinch in - zoom out using focal point
              onPinchZoomOut(currentCenterX, currentCenterY);
            }
            lastScale = scaleChange;
          }
        }
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (isPinching) {
        console.log("🤏 Ending pinch gesture");
        isPinching = false;
        initialDistance = 0;
        lastScale = 1;
      }
    };

    // Universal wheel event handler for mouse scroll and trackpad pinch
    let lastWheelTime = 0;
    const handleWheelZoom = (event: WheelEvent) => {
      event.preventDefault();
      
      // Reduced sensitivity with longer throttling
      const now = Date.now();
      if (now - lastWheelTime < 50) { // Increased from 8ms to 50ms for less sensitivity
        return;
      }
      lastWheelTime = now;
      
      // Use mouse position as focal point for wheel zoom
      const focalX = event.clientX;
      const focalY = event.clientY;
      
      // Determine zoom direction based on deltaY
      const zoomIn = event.deltaY < 0;
      
      // Immediate zoom for smooth response
      if (zoomIn) {
        onPinchZoomIn(focalX, focalY);
        console.log(event.ctrlKey ? '🖱️ Trackpad pinch zoom in' : '🖱️ Mouse wheel zoom in');
      } else {
        onPinchZoomOut(focalX, focalY);
        console.log(event.ctrlKey ? '🖱️ Trackpad pinch zoom out' : '🖱️ Mouse wheel zoom out');
      }
    };

    // Add touch and wheel event listeners directly to the SVG element
    const svgElement = svgRef.current;
    svgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    svgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    svgElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    svgElement.addEventListener('wheel', handleWheelZoom, { passive: false });

    // Cleanup function for all event listeners
    return () => {
      svgElement.removeEventListener('touchstart', handleTouchStart);
      svgElement.removeEventListener('touchmove', handleTouchMove);
      svgElement.removeEventListener('touchend', handleTouchEnd);
      svgElement.removeEventListener('wheel', handleWheelZoom);
    };
  }, [svgRef, onPinchZoomIn, onPinchZoomOut]);

  // Setup event listeners when visible
  useEffect(() => {
    if (!visible) return;
    
    const cleanup = setupTouchHandlers();
    return cleanup;
  }, [visible, setupTouchHandlers]);

  return {
    setupTouchHandlers,
  };
} 