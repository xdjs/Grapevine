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
        event.stopPropagation();
        
        if (!visible) return;
        
        // Reset previous node highlighting
        tooltip.resetNodeHighlight();
        
        // Highlight the current node group
        const currentNodeSelection = d3.select(nodeElement);
        const roles = node.types || [node.type];
        
        // Debug: Check the actual DOM structure
        console.log(`🎯 Node element tag:`, nodeElement.tagName);
        console.log(`🎯 Node children count:`, nodeElement.children.length);
        
        Array.from(nodeElement.children).forEach((child, index) => {
          console.log(`🎯 Child ${index}:`, child.tagName, child.className);
        });
        
        const allElements = currentNodeSelection.selectAll("*").nodes();
        console.log(`🎯 All descendant elements:`, allElements.length);
        allElements.forEach((el, index) => {
          console.log(`🎯 Element ${index}:`, el.tagName);
        });
        
        console.log(`🎯 D3 circle selection (lowercase):`, currentNodeSelection.selectAll("circle").size());
        console.log(`🎯 D3 circle selection (uppercase):`, currentNodeSelection.selectAll("CIRCLE").size());
        
        if (roles.length === 1) {
          // Single role node - turn the circle fill white
          console.log(`🎯 Highlighting single-role node: ${node.name} - setting fill to white`);
          currentNodeSelection.selectAll("circle")
            .attr("fill", "white");
        } else {
          // Multi-role node - thicken the white border of path elements
          console.log(`🎯 Highlighting multi-role node: ${node.name} - thickening borders`);
          currentNodeSelection.selectAll("path")
            .attr("stroke-width", 3);
          
          // Also thicken the inner circle border
          currentNodeSelection.selectAll("circle")
            .attr("stroke-width", 4);
        }
        
        // Track this node as highlighted
        console.log(`🎯 Setting highlighted node:`, currentNodeSelection);
        tooltip.setHighlightedNode(currentNodeSelection);
        
        // Show tooltip using the tooltip system
        tooltip.showTooltip(event, node);
        
        // Debug: Check the highlighting state immediately after
        setTimeout(() => {
          const circleNodes = currentNodeSelection.selectAll("circle").nodes() as SVGCircleElement[];
          const pathNodes = currentNodeSelection.selectAll("path").nodes() as SVGPathElement[];
          
          console.log(`🎯 Node highlighting check after 100ms:`, {
            nodeElement: nodeElement,
            circleElements: circleNodes,
            circleFills: circleNodes.map(el => el?.getAttribute('fill')),
            pathElements: pathNodes,
            pathStrokeWidths: pathNodes.map(el => el?.getAttribute('stroke-width'))
          });
        }, 100);
        
        console.log(`🎯 Node clicked: ${node.name} (${node.type}) - roles: [${roles.join(', ')}]`);
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