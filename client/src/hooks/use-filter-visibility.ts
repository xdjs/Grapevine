import { useEffect } from "react";
import * as d3 from "d3";
import { NetworkNode, NetworkLink, FilterState } from "@/types/network";

export interface UseFilterVisibilityProps {
  /** SVG element reference for D3 operations */
  svgRef: React.RefObject<SVGSVGElement>;
  /** Whether the component is visible and should apply filters */
  visible: boolean;
  /** Current filter state controlling visibility */
  filterState: FilterState;
}

export interface UseFilterVisibilityReturn {
  /** Checks if a node should be visible based on current filter state */
  isNodeVisible: (node: NetworkNode) => boolean;
}

/**
 * Custom hook for managing node/link visibility based on filter state.
 * 
 * This hook handles:
 * - Multi-role node visibility logic (visible if ANY role should be shown)
 * - Real-time filter updates with D3 DOM manipulation
 * - Link visibility based on connected nodes
 * - Performance optimization through direct DOM manipulation
 */
export function useFilterVisibility({
  svgRef,
  visible,
  filterState
}: UseFilterVisibilityProps): UseFilterVisibilityReturn {

  /**
   * Helper function to check if a node should be visible based on filter state.
   * For multi-role nodes, they are visible if ANY of their roles should be shown.
   */
  const isNodeVisible = (node: NetworkNode): boolean => {
    if (node.types && node.types.length > 0) {
      // Check if any of the node's roles should be visible
      for (const role of node.types) {
        if (role === "producer" && filterState.showProducers) return true;
        if (role === "songwriter" && filterState.showSongwriters) return true;
        if (role === "artist" && filterState.showArtists) return true;
      }
      return false;
    } else {
      // Fallback to single type if types array is not available
      if (node.type === "producer" && !filterState.showProducers) return false;
      if (node.type === "songwriter" && !filterState.showSongwriters) return false;
      if (node.type === "artist" && !filterState.showArtists) return false;
      return true;
    }
  };

  // Update visibility based on filter state
  useEffect(() => {
    if (!svgRef.current || !visible) return;

    const svg = d3.select(svgRef.current);

    // Hide/show nodes based on filter state
    svg.selectAll(".node-group").style("display", function () {
      const d = d3.select(this).datum() as NetworkNode;
      return isNodeVisible(d) ? null : "none";
    });

    // Hide/show labels based on filter state
    svg.selectAll(".label").style("display", function () {
      const d = d3.select(this).datum() as NetworkNode;
      return isNodeVisible(d) ? null : "none";
    });

    // Hide/show links based on whether both connected nodes are visible
    svg.selectAll(".link").style("display", function () {
      const d = d3.select(this).datum() as NetworkLink;
      const source = d.source as NetworkNode;
      const target = d.target as NetworkNode;
      
      const sourceVisible = isNodeVisible(source);
      const targetVisible = isNodeVisible(target);
      
      return sourceVisible && targetVisible ? null : "none";
    });
  }, [filterState, visible, isNodeVisible]);

  return {
    isNodeVisible
  };
}