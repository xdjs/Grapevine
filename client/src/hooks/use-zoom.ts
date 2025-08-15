import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface ZoomTransform {
  k: number;
  x: number;
  y: number;
}

interface UseZoomProps {
  svgRef: React.RefObject<SVGSVGElement>;
  visible: boolean;
  onZoomChange: (transform: ZoomTransform) => void;
}

export interface UseZoomReturn {
  currentZoom: number;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  applyZoom: (scale: number) => void;
  applyPinchZoom: (scale: number, focalX: number, focalY: number) => void;
  setupZoomBehavior: (networkGroup: d3.Selection<SVGGElement, unknown, null, undefined>) => void;
}

export function useZoom({ svgRef, visible, onZoomChange }: UseZoomProps): UseZoomReturn {
  const [currentZoom, setCurrentZoom] = useState(1);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Zoom function for buttons (centered zoom)
  const applyZoom = useCallback((scale: number) => {
    if (!svgRef.current) return;
   
    const container = svgRef.current.parentElement;
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
   
    // Calculate new viewBox dimensions centered
    const newWidth = width / scale;
    const newHeight = height / scale;
    const offsetX = (width - newWidth) / 2;
    const offsetY = (height - newHeight) / 2;
   
    // Apply smooth transition
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(200)
      .attrTween('viewBox', () => {
        const currentViewBox = svgRef.current?.getAttribute('viewBox') || `0 0 ${width} ${height}`;
        const [cx, cy, cw, ch] = currentViewBox.split(' ').map(Number);
        const interpolator = d3.interpolate([cx, cy, cw, ch], [offsetX, offsetY, newWidth, newHeight]);
        return (t: number) => {
          const [x, y, w, h] = interpolator(t);
          return `${x} ${y} ${w} ${h}`;
        };
      });
  }, [svgRef]);

  // Zoom function for pinch gestures (zoom around focal point)
  const applyPinchZoom = useCallback((scale: number, focalX: number, focalY: number) => {
    if (!svgRef.current) return;
   
    const container = svgRef.current.parentElement;
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
   
    // Get current viewBox
    const currentViewBox = svgRef.current.getAttribute('viewBox') || `0 0 ${width} ${height}`;
    const [currentX, currentY, currentWidth, currentHeight] = currentViewBox.split(' ').map(Number);
   
    // Calculate new dimensions
    const newWidth = width / scale;
    const newHeight = height / scale;
   
    // Calculate focal point in viewBox coordinates
    const focalXInViewBox = currentX + (focalX / width) * currentWidth;
    const focalYInViewBox = currentY + (focalY / height) * currentHeight;
   
    // Calculate new viewBox position to keep focal point in same screen position
    const newX = focalXInViewBox - (focalX / width) * newWidth;
    const newY = focalYInViewBox - (focalY / height) * newHeight;
   
    // Apply transition
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(100) // Shorter duration for more responsive pinch zoom
      .attrTween('viewBox', () => {
        const interpolator = d3.interpolate([currentX, currentY, currentWidth, currentHeight], [newX, newY, newWidth, newHeight]);
        return (t: number) => {
          const [x, y, w, h] = interpolator(t);
          return `${x} ${y} ${w} ${h}`;
        };
      });
  }, [svgRef]);

  const handlePinchZoomIn = useCallback((focalX: number, focalY: number) => {
    setCurrentZoom(prevZoom => {
      const newZoom = Math.min(100, prevZoom * 1.5); // Increased zoom limit
      console.log(`🤏 Pinch zoom in: ${prevZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
      applyZoom(newZoom); // Use the same zoom system as buttons
      return newZoom;
    });
  }, [applyZoom]);

  const handlePinchZoomOut = useCallback((focalX: number, focalY: number) => {
    setCurrentZoom(prevZoom => {
      const newZoom = Math.max(0.01, prevZoom / 1.2); // Increased zoom out capability
      console.log(`🤏 Pinch zoom out: ${prevZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
      console.log(`🤏 Current zoom: ${prevZoom}, New zoom: ${newZoom}, Can zoom out: ${prevZoom > 0.01}`);
      applyZoom(newZoom); // Use the same zoom system as buttons
      return newZoom;
    });
  }, [applyZoom]);

  // Button zoom handlers
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(100, currentZoom * 1.2); // Cap at 100x
    setCurrentZoom(newZoom);
    applyZoom(newZoom);
    console.log(`Zooming from ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
  }, [currentZoom, applyZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(0.01, currentZoom / 1.2); // Min 0.01x
    setCurrentZoom(newZoom);
    applyZoom(newZoom);
    console.log(`Zooming from ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
  }, [currentZoom, applyZoom]);

  const handleZoomReset = useCallback(() => {
    if (!svgRef.current) return;
    
    const container = svgRef.current.parentElement;
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    
    // Reset to default viewBox (centered, 1x zoom)
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(300)
      .attr('viewBox', `0 0 ${width} ${height}`);
    
    setCurrentZoom(1);
    console.log('Zoom and position reset to center');
  }, [svgRef]);

  // Touch and wheel event handlers
  const setupTouchAndWheelHandlers = useCallback(() => {
    if (!svgRef.current) return () => {};

    // Pinch zoom variables
    let initialDistance = 0;
    let lastScale = 1;
    let isPinching = false;
    const pinchThreshold = 0.5; // More responsive - easier to register pinch gestures
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
            console.log(`🤏 Pinch gesture detected: scaleChange=${scaleChange.toFixed(2)}, lastScale=${lastScale.toFixed(2)}, threshold=${pinchThreshold}`);
            if (scaleChange > lastScale) {
              // Pinch out - zoom in using focal point
              console.log(`🤏 Pinch OUT detected - zooming IN`);
              handlePinchZoomIn(currentCenterX, currentCenterY);
            } else {
              // Pinch in - zoom out using focal point
              console.log(`🤏 Pinch IN detected - zooming OUT`);
              handlePinchZoomOut(currentCenterX, currentCenterY);
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
        handlePinchZoomIn(focalX, focalY);
        console.log(event.ctrlKey ? '🖱️ Trackpad pinch zoom in' : '🖱️ Mouse wheel zoom in');
      } else {
        handlePinchZoomOut(focalX, focalY);
        console.log(event.ctrlKey ? '🖱️ Trackpad pinch zoom out' : '🖱️ Mouse wheel zoom out');
      }
    };

    // Add event listeners to SVG element
    const svgElement = svgRef.current;
    svgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    svgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    svgElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    svgElement.addEventListener('wheel', handleWheelZoom, { passive: false });

    // Return cleanup function
    return () => {
      svgElement.removeEventListener('touchstart', handleTouchStart);
      svgElement.removeEventListener('touchmove', handleTouchMove);
      svgElement.removeEventListener('touchend', handleTouchEnd);
      svgElement.removeEventListener('wheel', handleWheelZoom);
    };
  }, [svgRef, handlePinchZoomIn, handlePinchZoomOut]);

  // Setup D3 zoom behavior
  const setupZoomBehavior = useCallback((networkGroup: d3.Selection<SVGGElement, unknown, null, undefined>) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Create zoom behavior for mouse/touch interaction
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.01, 100])
      .filter((event) => {
        // Block all wheel events since we handle them manually for better zoom control
        // Block touch events since we handle them manually for better pinch zoom control
        const isWheelEvent = event.type === 'wheel';
        const isProgrammaticZoom = !event.sourceEvent && event.type !== 'click' && event.type !== 'mousedown';
        
        return !isWheelEvent && (isProgrammaticZoom || event.type === 'mousedown' || event.type === 'mousemove');
      })
      .on("zoom", (event) => {
        // Respond to user scroll wheel and programmatic zoom only
        const { transform } = event;
        networkGroup.attr("transform", transform);
        setCurrentZoom(transform.k);
        onZoomChange({ k: transform.k, x: transform.x, y: transform.y });
        // No DOM resets here to avoid flicker; watchdog runs on zoom end
      })
      .on("end", () => {
        // Visibility watchdog: ensure elements are visible and transform is valid after pan/zoom end
        try {
          const g = svg.select('g.network-group');
          if (!g.empty()) {
            // If any display accidentally set to 'none', reset to visible
            svg.selectAll('.node-group,.label,.link').each(function() {
              const el = d3.select(this);
              const disp = el.style('display');
              if (disp === 'none') el.style('display', null);
            });
            // If validLinks collapsed to zero in the DOM, trigger a lightweight redraw by toggling visibility
            const linkCount = svg.selectAll('.link').size();
            if (linkCount === 0) {
              svg.selectAll('.node-group,.label').style('display', null);
            }
          }
          // Guard against non-finite transform values
          const m = (g.node() as SVGGElement)?.getCTM();
          if (m && (!isFinite(m.a) || !isFinite(m.d) || !isFinite(m.e) || !isFinite(m.f))) {
            // Reset viewBox if corrupt
            const container = svgRef.current?.parentElement;
            const width = container ? container.clientWidth : window.innerWidth;
            const height = container ? container.clientHeight : window.innerHeight;
            svg.attr('viewBox', `0 0 ${width} ${height}`);
            setCurrentZoom(1);
          }
        } catch {
          // Ignore watchdog errors
        }
      });

    // Apply zoom behavior but prevent background dragging and clicking
    svg.call(zoom);
    zoomRef.current = zoom;

    // Completely disable D3's touch handling - we'll handle it manually
    svg.on("mousedown.drag", null)
       .on("click.zoom", null)
       .on("dblclick.zoom", null)
       .on("touchstart.zoom", null)
       .on("touchmove.zoom", null)
       .on("touchend.zoom", null);
  }, [svgRef, onZoomChange]);

  // Handle custom zoom events from zoom controls
  useEffect(() => {
    const handleZoomEvent = (event: CustomEvent) => {
      const { action } = event.detail;

      switch (action) {
        case "in":
          handleZoomIn();
          break;
        case "out":
          handleZoomOut();
          break;
        case "reset":
          handleZoomReset();
          break;
      }
    };

    if (visible) {
      window.addEventListener("network-zoom", handleZoomEvent as EventListener);
    }
    
    return () => {
      window.removeEventListener("network-zoom", handleZoomEvent as EventListener);
    };
  }, [visible, handleZoomIn, handleZoomOut, handleZoomReset]);

  // Setup touch and wheel event handlers
  useEffect(() => {
    if (!visible) return;
    
    const cleanup = setupTouchAndWheelHandlers();
    return cleanup;
  }, [visible, setupTouchAndWheelHandlers]);

  return {
    currentZoom,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    applyZoom,
    applyPinchZoom,
    setupZoomBehavior,
  };
} 