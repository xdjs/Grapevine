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
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  // Zoom function for buttons (centered zoom)
  const applyZoom = useCallback((scale: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    
    const container = svgRef.current.parentElement;
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    
    // Calculate center of the current view
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Create new transform centered on the view center
    const newTransform = d3.zoomIdentity
      .translate(centerX - (centerX * scale), centerY - (centerY * scale))
      .scale(scale);
    
    // Apply the transform using the zoom behavior
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(200)
      .call(zoomRef.current.transform, newTransform);
    
    currentTransformRef.current = newTransform;
    setCurrentZoom(scale);
    onZoomChange({ k: scale, x: newTransform.x, y: newTransform.y });
  }, [svgRef, onZoomChange]);

  // Zoom function for pinch gestures (zoom around focal point)
  const applyPinchZoom = useCallback((scale: number, focalX: number, focalY: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    
    // Get current transform
    const currentTransform = currentTransformRef.current;
    
    // Calculate focal point in SVG coordinates
    const focalPoint = d3.pointer({ clientX: focalX, clientY: focalY }, svgRef.current);
    
    // Create new transform that zooms around the focal point
    const newTransform = currentTransform
      .scale(scale / currentTransform.k)
      .translate(
        focalPoint[0] * (1 - scale / currentTransform.k),
        focalPoint[1] * (1 - scale / currentTransform.k)
      );
    
    // Apply the transform using the zoom behavior
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(100)
      .call(zoomRef.current.transform, newTransform);
    
    currentTransformRef.current = newTransform;
    setCurrentZoom(scale);
    onZoomChange({ k: scale, x: newTransform.x, y: newTransform.y });
  }, [svgRef, onZoomChange]);

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
    
    // Reset to default transform (no zoom, no pan)
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity);
    
    currentTransformRef.current = d3.zoomIdentity;
    setCurrentZoom(1);
    onZoomChange({ k: 1, x: 0, y: 0 });
    console.log('Zoom and position reset to center');
  }, [svgRef, onZoomChange]);

  // Touch and wheel event handlers
  const setupTouchAndWheelHandlers = useCallback(() => {
    if (!svgRef.current) return () => {};

    // Pinch zoom variables
    let initialDistance = 0;
    let lastScale = 1;
    let isPinching = false;
    const pinchThreshold = 0.5; // Increased threshold for less sensitivity
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
      .filter((event) => {
        // Block wheel events since we handle them manually for better zoom control
        // Block touch events since we handle them manually for better pinch zoom control
        const isWheelEvent = event.type === 'wheel';
        const isTouchEvent = event.type.startsWith('touch');
        
        // Allow all mouse events for panning
        return !isWheelEvent && !isTouchEvent;
      })
      .on("zoom", (event) => {
        // Handle zoom and pan events
        const { transform } = event;
        
        // Apply transform to the network group
        networkGroup.attr("transform", transform);
        
        // Update our internal state
        currentTransformRef.current = transform;
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
            // Reset transform if corrupt
            svg.call(zoom.transform, d3.zoomIdentity);
            currentTransformRef.current = d3.zoomIdentity;
            setCurrentZoom(1);
            onZoomChange({ k: 1, x: 0, y: 0 });
          }
        } catch {
          // Ignore watchdog errors
        }
      });

    // Apply zoom behavior - this enables both zooming and panning
    svg.call(zoom);
    zoomRef.current = zoom;

    // Keep D3's mouse handling for panning, but disable touch handling since we handle it manually
    svg.on("touchstart.zoom", null)
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