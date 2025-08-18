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
  setCurrentZoom: (zoom: number | ((prev: number) => number)) => void;
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
  const pendingScaleRef = useRef<number | null>(null);
  const pendingScalePointRef = useRef<[number, number] | null>(null);

  // Zoom function for buttons (centered zoom) - use d3.zoom to keep pan/zoom consistent
  const applyZoom = useCallback((scale: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    if (zoomRef.current) {
      (zoomRef.current as any).scaleTo(svg, scale);
    } else {
      // Defer until zoom behavior is initialized
      pendingScaleRef.current = scale;
      pendingScalePointRef.current = null;
    }
  }, [svgRef]);

  // Zoom function for pinch gestures (zoom around focal point) via d3.zoom
  const applyPinchZoom = useCallback((scale: number, focalX: number, focalY: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    if (zoomRef.current) {
      (zoomRef.current as any).scaleTo(svg, scale, [focalX, focalY]);
    } else {
      // Defer until zoom behavior is initialized
      pendingScaleRef.current = scale;
      pendingScalePointRef.current = [focalX, focalY];
    }
  }, [svgRef]);

  // Pinch zoom helpers
      const handlePinchZoomIn = useCallback((focalX: number, focalY: number) => {
      setCurrentZoom(prevZoom => {
        const newZoom = Math.min(1000, prevZoom * 1.15); // Cap at 1000x (more responsive zoom - 15% increase)
        console.log(`🤏 Pinch zoom in: ${prevZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
        applyPinchZoom(newZoom, focalX, focalY);
        return newZoom;
      });
    }, [applyPinchZoom]);

    const handlePinchZoomOut = useCallback((focalX: number, focalY: number) => {
      setCurrentZoom(prevZoom => {
        const newZoom = Math.max(0.001, prevZoom / 1.15); // Min 0.001x (more responsive zoom - 15% decrease)
        console.log(`🤏 Pinch zoom out: ${prevZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
        applyPinchZoom(newZoom, focalX, focalY);
        return newZoom;
      });
    }, [applyPinchZoom]);

  // Button zoom handlers
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(1000, currentZoom * 1.2); // Cap at 1000x (dramatic zoom)
    setCurrentZoom(newZoom);
    applyZoom(newZoom);
    console.log(`Zooming from ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
  }, [currentZoom, applyZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(0.001, currentZoom / 1.2); // Min 0.001x (dramatic zoom out)
    setCurrentZoom(newZoom);
    applyZoom(newZoom);
    console.log(`Zooming from ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
  }, [currentZoom, applyZoom]);

  const handleZoomReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    (zoomRef.current as any).transform(svg, d3.zoomIdentity);
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
    const pinchThreshold = 0.05; // Low threshold for responsive pinch
    let pinchCenterX = 0;
    let pinchCenterY = 0;

    // Custom touch event handlers
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
              handlePinchZoomIn(currentCenterX, currentCenterY);
            } else {
              // Pinch in - zoom out using focal point
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
      // Only handle wheel when cursor is over the SVG; otherwise allow page scroll
      const targetIsSvg = (event.target as Element)?.closest('svg') === svgRef.current;
      if (!targetIsSvg) return;
      event.preventDefault();
      
      // Reduced sensitivity with longer throttling
      const now = Date.now();
      if (now - lastWheelTime < 150) { // Increased from 50ms to 150ms for much less sensitivity
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
      .scaleExtent([0.001, 1000])
      .filter((event: any) => {
        // Block wheel (manual), and any touch pointer/touch events (manual pinch). Allow mouse for panning.
        if (event.type === 'wheel') return false;
        if (event.type && event.type.startsWith('touch')) return false;
        if (event.pointerType === 'touch') return false;
        return true;
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
        // Visibility watchdog: ensure elements are visible after pan/zoom end
        try {
          const g = svg.select('g.network-group');
          if (!g.empty()) {
            svg.selectAll('.node-group,.label,.link').each(function() {
              const el = d3.select(this);
              const disp = el.style('display');
              if (disp === 'none') el.style('display', null);
            });
          }
        } catch {
          // Ignore watchdog errors
        }
      });

    // Apply zoom behavior but prevent background dragging and clicking
    svg.call(zoom);
    zoomRef.current = zoom;

    // If a zoom was requested before initialization, apply it now
    if (pendingScaleRef.current != null) {
      const pendingScale = pendingScaleRef.current;
      const pendingPoint = pendingScalePointRef.current;
      pendingScaleRef.current = null;
      pendingScalePointRef.current = null;
      if (pendingPoint) {
        (zoomRef.current as any).scaleTo(svg, pendingScale, pendingPoint);
      } else {
        (zoomRef.current as any).scaleTo(svg, pendingScale);
      }
    }

    // Disable only touch and double-click zoom behaviors; keep mouse drag for panning
    svg
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
    setCurrentZoom,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    applyZoom,
    applyPinchZoom,
    setupZoomBehavior,
  };
} 