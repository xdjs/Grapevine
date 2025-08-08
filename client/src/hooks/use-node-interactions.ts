import { useCallback, useRef, useState } from 'react';
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
  /** Currently selected node element */
  selectedNode: d3.Selection<SVGGElement, unknown, null, undefined> | null;
  /** Reset all node selections */
  resetAllSelections: () => void;
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
  
  // State for tracking the currently selected node
  const [selectedNode, setSelectedNode] = useState<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  
  /**
   * Reset the currently selected node back to its original styling
   */
  const resetNodeSelection = useCallback((nodeSelection: d3.Selection<SVGGElement, unknown, null, undefined>) => {
    if (!nodeSelection || nodeSelection.empty()) return;
    
    try {
      const nodeData = nodeSelection.datum() as NetworkNode;
      const roles = nodeData.types || [nodeData.type];
      
      if (roles.length === 1) {
        // Single role - reset to original stroke color and width
        nodeSelection.selectAll("circle")
          .attr("stroke", () => {
            if (roles[0] === 'artist') return '#FF0ACF';       // Magenta Pink
            if (roles[0] === 'producer') return '#AE53FF';     // Bright Purple  
            if (roles[0] === 'songwriter') return '#67D1F8';   // Light Blue
            return '#355367';  // Police Blue
          })
          .attr("stroke-width", 4);
      } else {
        // Multiple roles - reset path strokes and inner circle
        nodeSelection.selectAll("path")
          .attr("stroke", "white")
          .attr("stroke-width", 1);
        
        nodeSelection.selectAll("circle")
          .attr("stroke", "white")
          .attr("stroke-width", 2);
      }
    } catch (error) {
      console.error('🎯 Error resetting node selection:', error);
    }
  }, []);
  
  /**
   * Reset all node selections
   */
  const resetAllSelections = useCallback(() => {
    if (selectedNode && !selectedNode.empty()) {
      resetNodeSelection(selectedNode);
      setSelectedNode(null);
    }
  }, [selectedNode, resetNodeSelection]);
  
  /**
   * Apply white stroke highlighting to a selected node
   */
  const applySelectionHighlight = useCallback((nodeSelection: d3.Selection<SVGGElement, unknown, null, undefined>) => {
    if (!nodeSelection || nodeSelection.empty()) return;
    
    try {
      const nodeData = nodeSelection.datum() as NetworkNode;
      const roles = nodeData.types || [nodeData.type];
      
      if (roles.length === 1) {
        // Single role - apply white stroke
        nodeSelection.selectAll("circle")
          .attr("stroke", "white")
          .attr("stroke-width", 3);
      } else {
        // Multiple roles - apply white stroke to both paths and inner circle
        nodeSelection.selectAll("path")
          .attr("stroke", "white")
          .attr("stroke-width", 3);
        
        nodeSelection.selectAll("circle")
          .attr("stroke", "white")
          .attr("stroke-width", 3);
      }
      
      console.log(`✨ Applied white stroke selection to: ${nodeData.name}`);
    } catch (error) {
      console.error('🎯 Error applying selection highlight:', error);
    }
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
   * Manages highlighting and tooltip display with improved selection mechanism.
   */
  const handleNodeClick = useCallback(
    (event: MouseEvent, node: NetworkNode, nodeElement: SVGGElement) => {
      try {
        event.stopPropagation();
        
        if (!visible) return;
        
        const currentNodeSelection = d3.select(nodeElement);
        
        // Reset any previously selected node back to original colors
        if (selectedNode && !selectedNode.empty()) {
          resetNodeSelection(selectedNode);
        }
        
        // Reset tooltip highlighting (this is separate from selection highlighting)
        tooltip.resetNodeHighlight();
        
        // Apply white stroke selection highlighting to the current node
        applySelectionHighlight(currentNodeSelection);
        
        // Track this node as selected
        setSelectedNode(currentNodeSelection);
        
        // Track this node as highlighted for tooltip system
        tooltip.setHighlightedNode(currentNodeSelection);
        
        // Show tooltip using the tooltip system
        tooltip.showTooltip(event, node);
        
        console.log(`🎯 Node selected: ${node.name} (${node.type}) - white stroke applied`);
      } catch (error) {
        console.error('🎯 Error handling node click:', error);
        // Continue execution - don't let errors break the interaction
      }
    },
    [tooltip, visible, selectedNode, resetNodeSelection, applySelectionHighlight]
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
    selectedNode,
    resetAllSelections,
  };
}