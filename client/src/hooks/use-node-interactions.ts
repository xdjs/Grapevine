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
   * Manages highlighting and tooltip display.
   */
  const handleNodeClick = useCallback(
    (event: MouseEvent, node: NetworkNode, nodeElement: SVGGElement) => {
      try {
        console.log(`🎯 *** NODE CLICK EVENT FIRED ***`);
        console.log(`🎯 Event:`, event);
        console.log(`🎯 Node:`, node);
        console.log(`🎯 Element:`, nodeElement);
        console.log(`🎯 Visible:`, visible);
        
        event.stopPropagation();
        
        if (!visible) {
          console.log(`🎯 Not visible, returning early`);
          return;
        }
        
        // Reset previous node highlighting
        tooltip.resetNodeHighlight();
        
        // Highlight the current node group based on role type
        const currentNodeSelection = d3.select(nodeElement);
        const roles = node.types || [node.type];
        
        console.log(`🎯 Highlighting node "${node.name}" with roles: [${roles.join(', ')}]`);
        console.log(`🎯 Node element:`, nodeElement);
        console.log(`🎯 D3 selection:`, currentNodeSelection);
        
        if (roles.length === 1) {
          // Single role - turn node completely white
          console.log(`🎯 Applying single role highlighting (white fill)`);
          const circleSelection = currentNodeSelection.selectAll("circle");
          console.log(`🎯 Circle selection:`, circleSelection);
          console.log(`🎯 Circle count:`, circleSelection.size());
          
          // Add CSS class for highlighting
          currentNodeSelection.classed("node-highlighted-single", true);
          console.log(`🎯 Added class "node-highlighted-single" to node`);
          console.log(`🎯 Node classes after highlight:`, nodeElement.className.baseVal);
          
          // FALLBACK: Also apply direct styles to ensure visibility
          circleSelection
            .style("fill", "white")
            .style("stroke", "white") 
            .style("stroke-width", "6px")  // Make it even thicker so it's obvious
            .style("opacity", "1");
            
          console.log(`🎯 Applied fallback direct styles to circles`);
          
          // Also verify the element in DOM
          setTimeout(() => {
            console.log(`🎯 DOM element after 100ms:`, nodeElement);
            console.log(`🎯 DOM classes:`, nodeElement.classList);
            console.log(`🎯 Applied styles:`, window.getComputedStyle(nodeElement));
          }, 100);
          
        } else {
          // Multiple roles - thicker white border
          console.log(`🎯 Applying multi-role highlighting (thicker borders)`);
          const pathSelection = currentNodeSelection.selectAll("path");
          const circleSelection = currentNodeSelection.selectAll("circle");
          console.log(`🎯 Path selection count:`, pathSelection.size());
          console.log(`🎯 Circle selection count:`, circleSelection.size());
          
          // Add CSS class for highlighting
          currentNodeSelection.classed("node-highlighted-multi", true);
          console.log(`🎯 Added class "node-highlighted-multi" to node`);
          console.log(`🎯 Node classes after highlight:`, nodeElement.className.baseVal);
          
          // FALLBACK: Also apply direct styles to ensure visibility
          pathSelection
            .style("stroke", "white")
            .style("stroke-width", "8px");  // Make it very thick so it's obvious
            
          circleSelection  
            .style("stroke", "white")
            .style("stroke-width", "10px");  // Make it very thick so it's obvious
            
          console.log(`🎯 Applied fallback direct styles to paths and circles`);
          
          // Also verify the element in DOM
          setTimeout(() => {
            console.log(`🎯 DOM element after 100ms:`, nodeElement);
            console.log(`🎯 DOM classes:`, nodeElement.classList);
          }, 100);
        }
        
        // Track this node as highlighted
        tooltip.setHighlightedNode(currentNodeSelection);
        
        // Show tooltip using the tooltip system
        tooltip.showTooltip(event, node);
        
        console.log(`🎯 Node clicked: ${node.name} (${node.type})`);
      } catch (error) {
        console.error('🎯 Error handling node click:', error);
        // Continue execution - don't let errors break the interaction
      }
    },
    [tooltip, visible]
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
  };
}