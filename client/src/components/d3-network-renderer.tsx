import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import { UseZoomReturn } from "@/hooks/use-zoom";
import { UseNodeInteractionsReturn } from "@/hooks/use-node-interactions";
import { UseTooltipReturn } from "@/hooks/use-tooltip";

export interface D3NetworkRendererProps {
  /** Network data to visualize */
  data: NetworkData;
  /** Whether the component is visible and should render */
  visible: boolean;
  /** Filter state for controlling node/link visibility */
  filterState: FilterState;
  /** SVG element reference for D3 rendering */
  svgRef: React.RefObject<SVGSVGElement>;
  /** D3 simulation reference for coordination */
  simulationRef: React.RefObject<d3.Simulation<NetworkNode, NetworkLink> | null>;
  /** Zoom management system */
  zoom: UseZoomReturn;
  /** Node interaction system */
  nodeInteractions: UseNodeInteractionsReturn;
  /** Tooltip management system */
  tooltip: UseTooltipReturn;
  /** Main artist node for special positioning */
  mainArtistNode?: NetworkNode;
}

/**
 * D3 Network Renderer Component
 * 
 * Handles the core D3.js visualization including:
 * - SVG setup and rendering
 * - Force simulation management
 * - Node and link rendering with multi-role support
 * - Connected components calculation and positioning
 * - Boundary forces and viewport constraints
 * - Filter-based visibility management
 */
export default function D3NetworkRenderer({
  data,
  visible,
  filterState,
  svgRef,
  simulationRef,
  zoom,
  nodeInteractions,
  tooltip,
  mainArtistNode,
}: D3NetworkRendererProps) {
  
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

  /**
   * Find connected components for cluster positioning.
   * Groups nodes that are connected by links into separate components.
   */
  const findConnectedComponents = (nodes: NetworkNode[], links: NetworkLink[]): NetworkNode[][] => {
    const visited = new Set<string>();
    const components: NetworkNode[][] = [];
    
    for (const node of nodes) {
      if (visited.has(node.id)) continue;
      
      const component: NetworkNode[] = [];
      const queue = [node];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.id)) continue;
        
        visited.add(current.id);
        component.push(current);
        
        // Find connected nodes
        for (const link of links) {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          
          if (sourceId === current.id) {
            const target = nodes.find(n => n.id === targetId);
            if (target && !visited.has(target.id)) queue.push(target);
          } else if (targetId === current.id) {
            const source = nodes.find(n => n.id === sourceId);
            if (source && !visited.has(source.id)) queue.push(source);
          }
        }
      }
      
      if (component.length > 0) components.push(component);
    }
    
    return components;
  };

  /**
   * Create boundary force to keep nodes within viewport with margin.
   */
  const createBoundaryForce = (width: number, height: number) => {
    return () => {
      const margin = 30; // Reduced margin for tighter bounds
      const container = svgRef.current?.parentElement;
      const currentWidth = container ? container.clientWidth : width;
      const currentHeight = container ? container.clientHeight : height;
      
      for (const node of data.nodes) {
        if (!node.x || !node.y) continue;
        
        // Ensure nodes stay well within bounds
        if (node.x < margin) node.x = margin;
        if (node.x > currentWidth - margin) node.x = currentWidth - margin;
        if (node.y < margin) node.y = margin;
        if (node.y > currentHeight - margin) node.y = currentHeight - margin;
        
        // Additional safety check - if somehow a node is outside, bring it back
        if (node.x < 0 || node.x > currentWidth || node.y < 0 || node.y > currentHeight) {
          node.x = Math.max(margin, Math.min(currentWidth - margin, node.x));
          node.y = Math.max(margin, Math.min(currentHeight - margin, node.y));
        }
      }
    };
  };

  /**
   * Position components in a grid layout to prevent overlap.
   */
  const positionComponents = (
    components: NetworkNode[][],
    width: number,
    height: number,
    mainArtist?: NetworkNode
  ) => {
    const componentsPerRow = Math.ceil(Math.sqrt(components.length));
    const componentWidth = width / componentsPerRow;
    const componentHeight = height / Math.ceil(components.length / componentsPerRow);
    
    components.forEach((component, index) => {
      const row = Math.floor(index / componentsPerRow);
      const col = index % componentsPerRow;
      const centerX = col * componentWidth + componentWidth / 2;
      const centerY = row * componentHeight + componentHeight / 2;
      
      component.forEach(node => {
        if (!node.x && !node.y) {
          // If this is the main artist node, center it in the viewport
          if (node === mainArtist) {
            node.x = width / 2;
            node.y = height / 2;
          } else {
            node.x = centerX + (Math.random() - 0.5) * 100;
            node.y = centerY + (Math.random() - 0.5) * 100;
          }
        }
      });
    });
  };

  /**
   * Create D3 simulation with all necessary forces.
   */
  const createSimulation = (
    nodes: NetworkNode[],
    links: NetworkLink[],
    width: number,
    height: number,
    mainArtist?: NetworkNode
  ) => {
    const boundaryForce = createBoundaryForce(width, height);
    
    return d3
      .forceSimulation<NetworkNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(links)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force("collision", d3.forceCollide<NetworkNode>().radius((d) => d.size + 10))
      .force("boundary", boundaryForce)
      .force("centerX", d3.forceX(width / 2).strength((d) => d === mainArtist ? 0.1 : 0))
      .force("centerY", d3.forceY(height / 2).strength((d) => d === mainArtist ? 0.1 : 0));
  };

  /**
   * Render node elements with multi-role support.
   * Single-role nodes get simple circles, multi-role nodes get segmented circles.
   */
  const renderNodes = (
    networkGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: NetworkNode[]
  ) => {
    const nodeElements = networkGroup
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", (d) => `node-group network-node node-${d.type}`)
      .style("cursor", "pointer");

    // Add circles for each node - single color for single role, multi-colored for multiple roles
    nodeElements.each(function(d) {
      const group = d3.select(this);
      const roles = d.types || [d.type];
      
      // Debug multi-role nodes
      if (roles.length > 1) {
        console.log(`🎭 [D3Renderer] Multi-role node "${d.name}": roles = [${roles.join(', ')}]`);
      }
      
      if (roles.length === 1) {
        // Single role - simple circle
        group.append("circle")
          .attr("r", d.size)
          .attr("fill", "transparent")
          .attr("stroke", () => {
            if (roles[0] === 'artist') return '#FF0ACF';       // Magenta Pink
            if (roles[0] === 'producer') return '#AE53FF';     // Bright Purple  
            if (roles[0] === 'songwriter') return '#67D1F8';   // Light Blue
            return '#355367';  // Police Blue
          })
          .attr("stroke-width", 4);
      } else {
        // Multiple roles - create segmented circle
        const angleStep = (2 * Math.PI) / roles.length;
        
        roles.forEach((role, index) => {
          const startAngle = index * angleStep;
          const endAngle = (index + 1) * angleStep;
          
          // Create arc path for each role
          const arcPath = d3.arc()
            .innerRadius(d.size - 4)
            .outerRadius(d.size)
            .startAngle(startAngle)
            .endAngle(endAngle);
          
          group.append("path")
            .attr("d", arcPath)
            .attr("fill", () => {
              if (role === 'artist') return '#FF0ACF';       // Magenta Pink
              if (role === 'producer') return '#AE53FF';     // Bright Purple  
              if (role === 'songwriter') return '#67D1F8';   // Light Blue
              return '#355367';  // Police Blue
            })
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .style("pointer-events", "all"); // Ensure click events work on arcs
        });
        
        // Add inner circle for better visibility
        group.append("circle")
          .attr("r", d.size - 4)
          .attr("fill", "transparent")
          .attr("stroke", "white")
          .attr("stroke-width", 2);
      }
    })
      .on("click", function(event, d) {
        // Use the node interactions hook for click handling
        nodeInteractions.handleNodeClick(event as MouseEvent, d, this);
      });

    // Setup drag behavior using the node interactions hook
    nodeInteractions.setupDragBehavior(nodeElements);

    return nodeElements;
  };

  /**
   * Render link elements.
   */
  const renderLinks = (
    networkGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    links: NetworkLink[]
  ) => {
    return networkGroup
      .selectAll(".link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link network-link")
      .attr("stroke", "#355367")
      .attr("stroke-width", 2);
  };

  /**
   * Render label elements for nodes.
   */
  const renderLabels = (
    networkGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: NetworkNode[]
  ) => {
    return networkGroup
      .selectAll(".label")
      .data(nodes)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => d.type === 'artist' ? "14px" : "11px")
      .attr("font-weight", (d) => d.type === 'artist' ? "600" : "500")
      .attr("fill", "white")
      .attr("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.8)")
      .text((d) => d.name);
  };

  // Main D3 visualization effect
  useEffect(() => {
    if (!svgRef.current || !data || !visible) return;

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    
    // Use container dimensions instead of window dimensions to avoid browser UI areas
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;

    // Clear existing content
    svg.selectAll("*").remove();

    // Filter out links where either node doesn't exist or is isolated
    const nodeSet = new Set(data.nodes.map(n => n.id));
    const validLinks = data.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return nodeSet.has(sourceId) && nodeSet.has(targetId);
    });

    // Create network group
    const networkGroup = svg.append("g").attr("class", "network-group");

    // Setup zoom behavior using the zoom hook
    zoom.setupZoomBehavior(networkGroup);

    // Add background click handler to hide tooltip and reset highlighting
    svg.on("click", function(event) {
      // Only trigger if clicking on the background (not on a node)
      if (event.target === this || event.target.tagName === 'svg') {
        tooltip.hideTooltip();
      }
    });

    // Find connected components for cluster positioning
    const components = findConnectedComponents(data.nodes, validLinks);
    
    // Position components in a grid layout to prevent overlap
    positionComponents(components, width, height, mainArtistNode);

    // Create and configure D3 simulation
    const simulation = createSimulation(data.nodes, validLinks, width, height, mainArtistNode);
    simulationRef.current = simulation;

    // Add resize listener to handle orientation changes
    const handleResize = () => {
      if (svgRef.current && simulationRef.current) {
        const container = svgRef.current.parentElement;
        const newWidth = container ? container.clientWidth : window.innerWidth;
        const newHeight = container ? container.clientHeight : window.innerHeight;
        
        // Update simulation forces with new dimensions
        simulationRef.current
          .force("centerX", d3.forceX(newWidth / 2).strength((d) => d === mainArtistNode ? 0.1 : 0))
          .force("centerY", d3.forceY(newHeight / 2).strength((d) => d === mainArtistNode ? 0.1 : 0))
          .alpha(0.3) // Restart simulation
          .restart();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Render visualization elements
    const linkElements = renderLinks(networkGroup, validLinks);
    const nodeElements = renderNodes(networkGroup, data.nodes);
    const labelElements = renderLabels(networkGroup, data.nodes);

    // Update positions on tick
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as NetworkNode).x!)
        .attr("y1", (d) => (d.source as NetworkNode).y!)
        .attr("x2", (d) => (d.target as NetworkNode).x!)
        .attr("y2", (d) => (d.target as NetworkNode).y!);

      nodeElements.attr("transform", (d) => `translate(${d.x!}, ${d.y!})`);

      labelElements.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    // Cleanup function
    return () => {
      simulation.stop();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [data, visible, mainArtistNode, zoom, nodeInteractions, tooltip, simulationRef, svgRef]);

  // Update visibility based on filter state
  useEffect(() => {
    if (!svgRef.current || !visible || !data) return;

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
  }, [filterState, visible]);

  // This component doesn't render JSX, it only manages D3 DOM manipulation
  return null;
}