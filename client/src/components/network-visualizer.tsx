import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";

interface NetworkVisualizerProps {
  data: NetworkData;
  visible: boolean;
  filterState: FilterState;
  onZoomChange: (transform: { k: number; x: number; y: number }) => void;
}

export default function NetworkVisualizer({
  data,
  visible,
  filterState,
  onZoomChange,
}: NetworkVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);

  useEffect(() => {
    if (!svgRef.current || !data || !visible) return;

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;

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

    // Create zoom behavior for mouse/touch interaction
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 8])
      .filter((event) => {
        // Only allow wheel events and programmatic zoom (no drag panning or clicks)
        // This prevents the tree from floating away when dragging on empty space
        return event.type === 'wheel' || (!event.sourceEvent && event.type !== 'click' && event.type !== 'mousedown');
      })
      .on("zoom", (event) => {
        // Respond to user scroll wheel and programmatic zoom only
        const { transform } = event;
        networkGroup.attr("transform", transform);
        setCurrentZoom(transform.k);
        onZoomChange({ k: transform.k, x: transform.x, y: transform.y });
      });

    // Apply zoom behavior but prevent background dragging and clicking
    svg.call(zoom);
    zoomRef.current = zoom;

    // Add explicit prevention of background interactions
    svg.on("mousedown.drag", null)
       .on("touchstart.drag", null)
       .on("click.zoom", null)
       .on("dblclick.zoom", null);

    // Find connected components for cluster positioning
    const findConnectedComponents = () => {
      const visited = new Set<string>();
      const components: NetworkNode[][] = [];
      
      for (const node of data.nodes) {
        if (visited.has(node.id)) continue;
        
        const component: NetworkNode[] = [];
        const queue = [node];
        
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current.id)) continue;
          
          visited.add(current.id);
          component.push(current);
          
          // Find connected nodes
          for (const link of validLinks) {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            if (sourceId === current.id) {
              const target = data.nodes.find(n => n.id === targetId);
              if (target && !visited.has(target.id)) queue.push(target);
            } else if (targetId === current.id) {
              const source = data.nodes.find(n => n.id === sourceId);
              if (source && !visited.has(source.id)) queue.push(source);
            }
          }
        }
        
        if (component.length > 0) components.push(component);
      }
      
      return components;
    };

    const components = findConnectedComponents();
    
    // Position components in a grid layout to prevent overlap
    const componentsPerRow = Math.ceil(Math.sqrt(components.length));
    const componentWidth = width / componentsPerRow;
    const componentHeight = height / Math.ceil(components.length / componentsPerRow);
    
    // Find the main artist node (the one being searched) - it has the largest size
    const mainArtistNode = data.nodes.find(node => node.size === 20 && node.type === 'artist');
    
    components.forEach((component, index) => {
      const row = Math.floor(index / componentsPerRow);
      const col = index % componentsPerRow;
      const centerX = col * componentWidth + componentWidth / 2;
      const centerY = row * componentHeight + componentHeight / 2;
      
      component.forEach(node => {
        if (!node.x && !node.y) {
          // If this is the main artist node, center it in the viewport
          if (node === mainArtistNode) {
            node.x = width / 2;
            node.y = height / 2;
          } else {
            node.x = centerX + (Math.random() - 0.5) * 100;
            node.y = centerY + (Math.random() - 0.5) * 100;
          }
        }
      });
    });

    // Create boundary force to keep nodes within viewport
    const boundaryForce = () => {
      const margin = 50;
      for (const node of data.nodes) {
        if (node.x! < margin) node.x = margin;
        if (node.x! > width - margin) node.x = width - margin;
        if (node.y! < margin) node.y = margin;
        if (node.y! > height - margin) node.y = height - margin;
      }
    };

    // Create simulation
    const simulation = d3
      .forceSimulation<NetworkNode>(data.nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(validLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force("collision", d3.forceCollide<NetworkNode>().radius((d) => d.size + 10))
      .force("boundary", boundaryForce);

    simulationRef.current = simulation;

    // Create links
    const linkElements = networkGroup
      .selectAll(".link")
      .data(validLinks)
      .enter()
      .append("line")
      .attr("class", "link network-link")
      .attr("stroke-width", 2);

    // Create nodes with direct styling
    const nodeElements = networkGroup
      .selectAll(".node")
      .data(data.nodes)
      .enter()
      .append("circle")
      .attr("class", (d) => `node network-node node-${d.type}`)
      .attr("r", (d) => d.size)
      .attr("fill", "transparent")
      .attr("stroke", (d) => {
        if (d.type === 'artist') return '#FF0ACF';       // Magenta Pink
        if (d.type === 'producer') return '#AE53FF';     // Bright Purple  
        if (d.type === 'songwriter') return '#67D1F8';   // Light Blue
        return '#355367';  // Police Blue
      })
      .attr("stroke-width", 4)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this).attr("stroke", "white").attr("stroke-width", 6);
        showTooltip(event, d);
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", function(event, d) {
        d3.select(this)
          .attr("stroke", (d) => {
            if (d.type === 'artist') return '#FF0ACF';       // Magenta Pink
            if (d.type === 'producer') return '#AE53FF';     // Bright Purple  
            if (d.type === 'songwriter') return '#67D1F8';   // Light Blue
            return '#355367';  // Police Blue
          })
          .attr("stroke-width", 4);
        hideTooltip();
      })
      .on("click", function(event, d) {
        event.stopPropagation();
        // Only open Music Nerd for artists, not producers or songwriters
        if (d.type === 'artist') {
          openMusicNerdProfile(d.name);
        }
      })
      .call(
        d3
          .drag<SVGCircleElement, NetworkNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    // Add labels for all nodes
    const labelElements = networkGroup
      .selectAll(".label")
      .data(data.nodes)
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

    // Create tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "network-tooltip")
      .style("position", "absolute")
      .style("opacity", 0);

    function showTooltip(event: MouseEvent, d: NetworkNode) {
      let content = `<strong>${d.name}</strong><br/>Type: ${d.type}`;

      if (d.collaborations && d.collaborations.length > 0) {
        content += `<br/><br/><strong>Top Collaborations:</strong><br/>`;
        content += d.collaborations.slice(0, 3).join("<br/>");
      }

      if (d.type === 'artist') {
        content += `<br/><br/><em>Click to search on Music Nerd</em>`;
      }

      tooltip.html(content).style("opacity", 1);
    }

    function moveTooltip(event: MouseEvent) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");
    }

    function hideTooltip() {
      tooltip.style("opacity", 0);
    }

    async function openMusicNerdProfile(artistName: string) {
      try {
        // Fetch the MusicNerd URL for this artist
        const response = await fetch(`/api/musicnerd-url/${encodeURIComponent(artistName)}`);
        const data = await response.json();
        
        console.log(`🎵 MusicNerd lookup for "${artistName}":`, data);
        
        // Open the MusicNerd profile URL
        const newWindow = window.open(data.profileUrl, '_blank', 'noopener,noreferrer');
        
        // If popup blocked, provide fallback
        if (!newWindow) {
          if (data.found) {
            alert(`Popup blocked! Please visit MusicNerd manually: ${data.profileUrl}`);
          } else {
            alert(`Popup blocked! Artist "${artistName}" not found in MusicNerd database. Please visit: https://music-nerd-git-staging-musicnerd.vercel.app/`);
          }
        }
      } catch (error) {
        console.error('Error fetching MusicNerd URL:', error);
        // Fallback to main MusicNerd page
        const fallbackUrl = 'https://music-nerd-git-staging-musicnerd.vercel.app/';
        const newWindow = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        
        if (!newWindow) {
          alert(`Popup blocked! Please visit MusicNerd manually: ${fallbackUrl}`);
        }
      }
    }

    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, NetworkNode, unknown>, d: NetworkNode) {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, NetworkNode, unknown>, d: NetworkNode) {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, NetworkNode, unknown>, d: NetworkNode) {
      // Prevent event bubbling to avoid interfering with zoom behavior
      event.sourceEvent.stopPropagation();
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Update positions on tick
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as NetworkNode).x!)
        .attr("y1", (d) => (d.source as NetworkNode).y!)
        .attr("x2", (d) => (d.target as NetworkNode).x!)
        .attr("y2", (d) => (d.target as NetworkNode).y!);

      nodeElements.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);

      labelElements.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    // Cleanup function
    return () => {
      tooltip.remove();
      simulation.stop();
    };
  }, [data, visible, onZoomChange]);

  // Update visibility based on filter state
  useEffect(() => {
    if (!svgRef.current || !visible) return;

    const svg = d3.select(svgRef.current);

    svg.selectAll(".node").style("opacity", function () {
      const d = d3.select(this).datum() as NetworkNode;
      if (d.type === "producer" && !filterState.showProducers) return 0;
      if (d.type === "songwriter" && !filterState.showSongwriters) return 0;
      if (d.type === "artist" && !filterState.showArtists) return 0;
      return 1;
    });

    svg.selectAll(".link").style("opacity", function () {
      const d = d3.select(this).datum() as NetworkLink;
      const source = d.source as NetworkNode;
      const target = d.target as NetworkNode;
      
      const sourceVisible = getNodeVisibility(source, filterState);
      const targetVisible = getNodeVisibility(target, filterState);
      
      return sourceVisible && targetVisible ? 0.6 : 0;
    });

    svg.selectAll(".label").style("opacity", function () {
      const d = d3.select(this).datum() as NetworkNode;
      return getNodeVisibility(d, filterState) ? 1 : 0;
    });
  }, [filterState, visible]);

  // SVG viewBox zoom function (working implementation)
  const applyZoom = (scale: number) => {
    if (!svgRef.current) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Calculate new viewBox dimensions
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
  };

  // Handle zoom button clicks
  const handleZoomIn = () => {
    const newZoom = Math.min(5, currentZoom * 1.2); // Cap at 5x
    setCurrentZoom(newZoom);
    applyZoom(newZoom);
    console.log(`Zooming from ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.2, currentZoom / 1.2); // Min 0.2x
    setCurrentZoom(newZoom);
    applyZoom(newZoom);
    console.log(`Zooming from ${currentZoom.toFixed(2)} to ${newZoom.toFixed(2)}`);
  };

  const handleZoomReset = () => {
    setCurrentZoom(1);
    applyZoom(1);
    console.log('Zoom reset to 1.00');
  };

  // Handle zoom controls with direct function calls
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
  }, [visible, currentZoom]);

  function getNodeVisibility(node: NetworkNode, filterState: FilterState): boolean {
    if (node.type === "producer") return filterState.showProducers;
    if (node.type === "songwriter") return filterState.showSongwriters;
    if (node.type === "artist") return filterState.showArtists;
    return true;
  }

  return (
    <div
      className={`w-full h-full transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
