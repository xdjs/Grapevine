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

  // Zoom function for buttons (centered zoom) - use d3.zoom to keep pan/zoom consistent
  const applyZoom = useCallback((scale: number) => {
    if (!svgRef.current) return;
    if (!zoomRef.current) {
      // Defer until zoom behavior is initialized
      pendingScaleRef.current = scale;
      return;
    }
    const svg = d3.select(svgRef.current);
    (zoomRef.current as any).scaleTo(svg, scale);
  }, [svgRef]);

  // Zoom function for pinch gestures (zoom around focal point) via d3.zoom
  const applyPinchZoom = useCallback((scale: number, focalX: number, focalY: number) => {
    if (!svgRef.current) return;
    if (!zoomRef.current) {
      pendingScaleRef.current = scale;
      return;
    }
    const svgSel = d3.select(svgRef.current);
    const rect = svgRef.current.getBoundingClientRect();
    const localX = focalX - rect.left;
    const localY = focalY - rect.top;
    (zoomRef.current as any).scaleTo(svgSel, scale, [localX, localY]);
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

  // Touch and wheel are handled by useTouchGestures to avoid conflicts here

  // Setup D3 zoom behavior
  const setupZoomBehavior = useCallback((networkGroup: d3.Selection<SVGGElement, unknown, null, undefined>) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Create zoom behavior for mouse/touch interaction
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.001, 1000])
      .filter((event) => {
        // Block only wheel (we handle manually) and touch (we handle manually). Allow mouse/pointer for panning.
        if (event.type === 'wheel') return false;
        if (event.type.startsWith('touch')) return false;
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

    // Apply zoom behavior
    svg.call(zoom);
    zoomRef.current = zoom;

    // Apply any pending scale if a zoom action happened before behavior was ready
    if (pendingScaleRef.current != null) {
      try {
        (zoomRef.current as any).scaleTo(svg, pendingScaleRef.current);
      } finally {
        pendingScaleRef.current = null;
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

  // Touch/wheel handled in separate hook

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