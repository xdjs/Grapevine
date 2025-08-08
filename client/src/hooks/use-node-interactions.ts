import { useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { NetworkNode, NetworkLink } from '@/types/network';
import { UseTooltipReturn } from './use-tooltip';

export interface UseNodeInteractionsParams {
  /** D3 simulation reference for managing drag behavior */
  simulationRef: React.RefObject<d3.Simulation<NetworkNode, NetworkLink> | null>;
  /** Tooltip system for coordinating interactions */
  tooltip: UseTooltipReturn;
  /** Whether the component is visible and should handle interactions */
  visible: boolean;
}

export interface UseNodeInteractionsReturn {
  /** Drag start handler for D3 drag behavior */
  dragstarted: (event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) => void;
  /** Drag handler for D3 drag behavior */
  dragged: (event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) => void;
  /** Drag end handler for D3 drag behavior */
  dragended: (event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) => void;
  /** Node click handler that coordinates with tooltip system */
  handleNodeClick: (event: MouseEvent, node: NetworkNode, nodeElement: SVGGElement) => void;
  /** Setup drag behavior on a D3 selection */
  setupDragBehavior: (selection: d3.Selection<SVGGElement, NetworkNode, d3.BaseType, unknown>) => void;
  /** Reset node highlighting back to original colors */
  resetNodeHighlight: () => void;
}

/**
 * Custom hook for managing node interactions including drag behavior and click handling.
 * Coordinates with the tooltip system for proper highlighting and event handling.
 */
export function useNodeInteractions({
  simulationRef,
  tooltip,
  visible,
}: UseNodeInteractionsParams): UseNodeInteractionsReturn {
  
  // Track currently highlighted node for direct manipulation
  const currentlyHighlightedNodeRef = useRef<{
    selection: d3.Selection<SVGGElement, unknown, null, undefined>;
    nodeData: NetworkNode;
  } | null>(null);
  
  /**
   * Reset node highlighting back to original colors.
   * Handles both single-role and multi-role nodes appropriately.
   */
  const resetNodeHighlight = useCallback(() => {
    const currentlyHighlighted = currentlyHighlightedNodeRef.current;
    if (!currentlyHighlighted) return;

    const { selection, nodeData } = currentlyHighlighted;
    const roles = nodeData.types || [nodeData.type];

    console.log(`🔄 Resetting highlight for: ${nodeData.name}`);

    try {
      if (roles.length === 1) {
        // Single role - reset to original stroke color and width
        selection.selectAll('circle')
          .attr('stroke', () => {
            if (roles[0] === 'artist') return '#FF0ACF';       // Magenta Pink
            if (roles[0] === 'producer') return '#AE53FF';     // Bright Purple  
            if (roles[0] === 'songwriter') return '#67D1F8';   // Light Blue
            return '#355367';  // Police Blue (default)
          })
          .attr('stroke-width', 4);
      } else {
        // Multiple roles - reset path strokes and inner circle to original white
        selection.selectAll('path')
          .attr('stroke', 'white')
          .attr('stroke-width', 1);
        
        selection.selectAll('circle')
          .attr('stroke', 'white')
          .attr('stroke-width', 2);
      }
    } catch (error) {
      console.error('🔄 Error resetting node highlight:', error);
    }

    // Clear the highlighted node reference
    currentlyHighlightedNodeRef.current = null;
  }, []);
  
  /**
   * Handles the start of a drag operation.
   * Prevents event bubbling and activates the simulation.
   */
  const dragstarted = useCallback(
    (event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) => {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      
      const simulation = simulationRef.current;
      if (!simulation || !visible) return;
      
      if (!event.active) {
        simulation.alphaTarget(0.3).restart();
      }
      
      // Fix the node position for dragging
      d.fx = d.x;
      d.fy = d.y;
      
      console.log(`🎯 Drag started for node: ${d.name}`);
    },
    [simulationRef, visible]
  );

  /**
   * Handles the drag operation.
   * Updates the node's fixed position based on drag coordinates.
   */
  const dragged = useCallback(
    (event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) => {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      
      if (!visible) return;
      
      // Update the node's fixed position
      d.fx = event.x;
      d.fy = event.y;
    },
    [visible]
  );

  /**
   * Handles the end of a drag operation.
   * Deactivates the simulation and releases the fixed position.
   */
  const dragended = useCallback(
    (event: d3.D3DragEvent<SVGGElement, NetworkNode, unknown>, d: NetworkNode) => {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      
      const simulation = simulationRef.current;
      if (!simulation || !visible) return;
      
      if (!event.active) {
        simulation.alphaTarget(0);
      }
      
      // Release the fixed position to let the simulation take over
      d.fx = null;
      d.fy = null;
      
      console.log(`🎯 Drag ended for node: ${d.name}`);
    },
    [simulationRef, visible]
  );

  /**
   * Handles node click events and coordinates with the tooltip system.
   * Manages highlighting and tooltip display with enhanced visual feedback.
   * 
   * Click Selection Mechanism:
   * 1. Reset any previously selected node back to original colors
   * 2. Apply white stroke highlighting to the clicked node
   * 3. Handle both single-role and multi-role nodes appropriately
   * 4. Show tooltip with interaction options
   */
  const handleNodeClick = useCallback(
    (event: MouseEvent, node: NetworkNode, nodeElement: SVGGElement) => {
      try {
        event.stopPropagation();
        
        if (!visible) return;
        
        // Reset previous node highlighting to original colors
        resetNodeHighlight();
        
        // Apply white stroke highlighting to the current node
        const currentNodeSelection = d3.select(nodeElement);
        
        // The white stroke effect provides visual feedback that:
        // - The node is currently selected
        // - Provides contrast against colored backgrounds  
        // - Prepares to show tooltip with interaction options
        currentNodeSelection.selectAll("circle, path")
          .attr("stroke", "white")
          .attr("stroke-width", 3)
          .style("stroke-opacity", 1);
        
        // Track this node as highlighted for reset mechanism
        currentlyHighlightedNodeRef.current = {
          selection: currentNodeSelection,
          nodeData: node
        };
        
        // Show tooltip using the tooltip system
        tooltip.showTooltip(event, node);
        
        console.log(`🎯 Node clicked: ${node.name} (${node.type})`);
        
        // Log multi-role node information for debugging
        const roles = node.types || [node.type];
        if (roles.length > 1) {
          console.log(`🎭 Multi-role node selected: ${node.name} has roles [${roles.join(', ')}]`);
        }
        
      } catch (error) {
        console.error('🎯 Error handling node click:', error);
        // Continue execution - don't let errors break the interaction
      }
    },
    [resetNodeHighlight, tooltip, visible]
  );

  /**
   * Sets up drag behavior on a D3 selection of node elements.
   */
  const setupDragBehavior = useCallback(
    (selection: d3.Selection<SVGGElement, NetworkNode, d3.BaseType, unknown>) => {
      try {
        if (!visible) return;
        
        selection.call(
          d3
            .drag<SVGGElement, NetworkNode>()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
        );
      } catch (error) {
        console.error('🎯 Error setting up drag behavior:', error);
        // Continue execution - don't let errors break the setup
      }
    },
    [dragstarted, dragged, dragended, visible]
  );

  return {
    dragstarted,
    dragged,
    dragended,
    handleNodeClick,
    setupDragBehavior,
    resetNodeHighlight,
  };
}