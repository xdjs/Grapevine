import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import ArtistSelectionModal from "./artist-selection-modal";

interface NetworkVisualizerProps {
  data: NetworkData;
  visible: boolean;
  filterState: FilterState;
  onZoomChange: (transform: { k: number; x: number; y: number }) => void;
  onArtistSearch?: (artistName: string) => void;
  onRecenter?: () => void;
}

export default function NetworkVisualizer({
  data,
  visible,
  filterState,
  onZoomChange,
  onArtistSearch,
  onRecenter,
}: NetworkVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState("");

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

    // Create zoom behavior for mouse/touch interaction - scroll wheel only
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 8])
      .filter((event) => {
        // Only allow wheel events and programmatic zoom - no drag panning
        return event.type === 'wheel' || !event.sourceEvent;
      })
      .on("zoom", (event) => {
        // Respond to user scroll wheel and programmatic zoom only
        const { transform } = event;
        networkGroup.attr("transform", transform);
        setCurrentZoom(transform.k);
        onZoomChange({ k: transform.k, x: transform.x, y: transform.y });
      });

    // Apply zoom behavior with panning disabled
    svg.call(zoom);
    zoomRef.current = zoom;

    // Prevent double-click zoom and drag interactions
    svg.on("dblclick.zoom", null)
       .on("mousedown.zoom", null)
       .on("touchstart.zoom", null);

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
      
      component.forEach((node, nodeIndex) => {
        if (!node.x && !node.y) {
          // If this is the main artist node, center it in the viewport
          if (node === mainArtistNode) {
            node.x = width / 2;
            node.y = height / 2;
          } else {
            // Use radial distribution around center with much more spacing
            const angle = (nodeIndex / component.length) * 2 * Math.PI;
            const radius = 200 + (Math.random() * 150); // Larger radius for better separation
            node.x = centerX + Math.cos(angle) * radius;
            node.y = centerY + Math.sin(angle) * radius;
            
            // Add more randomness for natural distribution
            node.x += (Math.random() - 0.5) * 100;
            node.y += (Math.random() - 0.5) * 100;
          }
        }
      });
    });

    // Create boundary force to keep nodes and their labels within viewport
    const boundaryForce = () => {
      for (const node of data.nodes) {
        // Calculate dynamic margin based on text length to account for labels
        const textLength = node.name.length;
        const textWidth = textLength * 4; // Approximate text width
        const margin = Math.max(60, textWidth / 2); // Ensure labels don't go off-screen
        
        if (node.x! < margin) node.x = margin;
        if (node.x! > width - margin) node.x = width - margin;
        if (node.y! < margin) node.y = margin;
        if (node.y! > height - margin) node.y = height - margin;
      }
    };

    // Create simulation with enhanced spacing to prevent text overlap
    const simulation = d3
      .forceSimulation<NetworkNode>(data.nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(validLinks)
          .id((d) => d.id)
          .distance(150) // Much larger link distance for better text spacing
      )
      .force("charge", d3.forceManyBody().strength(-500)) // Much stronger repulsion for better spacing
      .force("collision", d3.forceCollide<NetworkNode>().radius((d) => {
        // Calculate collision radius based on text length to prevent label overlap
        const textLength = d.name.length;
        const baseRadius = d.size + 40; // Increased base spacing around node
        const textRadius = textLength * 6; // Larger text width estimation
        return Math.max(baseRadius, textRadius + 20); // Extra padding for safety
      }).strength(1)) // Maximum collision strength
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1)) // Gentle centering
      .force("boundary", boundaryForce)
      .alpha(1) // Initial energy
      .alphaDecay(0.01) // Much slower cooling for better settling
      .velocityDecay(0.3) // Less damping for more movement
      .alphaMin(0.001); // Lower minimum alpha for longer simulation

    simulationRef.current = simulation;

    // Create links
    const linkElements = networkGroup
      .selectAll(".link")
      .data(validLinks)
      .enter()
      .append("line")
      .attr("class", "link network-link")
      .attr("stroke-width", 2);

    // Create nodes with multi-role support
    const nodeElements = networkGroup
      .selectAll(".node")
      .data(data.nodes)
      .enter()
      .append("g")
      .attr("class", (d) => `node-group network-node node-${d.type}`)
      .style("cursor", "pointer");

    // Add circles for each node - single color for single role, multi-colored for multiple roles
    nodeElements.each(function(d) {
      const group = d3.select(this);
      const roles = d.types || [d.type];
      
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
            .attr("stroke-width", 1);
        });
        
        // Add inner circle for better visibility
        group.append("circle")
          .attr("r", d.size - 4)
          .attr("fill", "transparent")
          .attr("stroke", "white")
          .attr("stroke-width", 2);
      }
    })
      .on("mouseover", function(event, d) {
        // Highlight the entire node group
        d3.select(this).selectAll("circle, path")
          .attr("stroke", "white")
          .attr("stroke-width", 3);
        showTooltip(event, d);
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", function(event, d) {
        // Reset the stroke colors for the entire node group
        const group = d3.select(this);
        const roles = d.types || [d.type];
        
        if (roles.length === 1) {
          group.select("circle")
            .attr("stroke", () => {
              if (roles[0] === 'artist') return '#FF0ACF';
              if (roles[0] === 'producer') return '#AE53FF';
              if (roles[0] === 'songwriter') return '#67D1F8';
              return '#355367';
            })
            .attr("stroke-width", 4);
        } else {
          group.selectAll("path")
            .attr("stroke", "white")
            .attr("stroke-width", 1);
          group.select("circle")
            .attr("stroke", "white")
            .attr("stroke-width", 2);
        }
        hideTooltip();
      })
      .on("click", function(event, d) {
        // Don't prevent propagation - allow panning to work
        // Open Music Nerd for any node that has an artist role
        if (d.type === 'artist' || (d.types && d.types.includes('artist'))) {
          openMusicNerdProfile(d.name, d.artistId);
        }
      })
      .on("contextmenu", function(event, d) {
        event.preventDefault();
        // Right-click to view artist's network (only for artist nodes that aren't the main artist)
        if ((d.type === 'artist' || (d.types && d.types.includes('artist'))) && onArtistSearch) {
          const mainArtistNode = data.nodes.find(node => node.size === 20 && node.type === 'artist');
          if (d !== mainArtistNode) {
            onArtistSearch(d.name);
          }
        }
      })
      // Node dragging disabled to allow full map panning

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
      const roles = d.types || [d.type];
      const roleDisplay = roles.length > 1 ? roles.join(' + ') : roles[0];
      
      let content = `<strong>${d.name}</strong><br/>Role${roles.length > 1 ? 's' : ''}: ${roleDisplay}`;

      // Show collaboration information for producers and songwriters
      const hasProducerRole = roles.includes('producer') || roles.includes('songwriter');
      if (hasProducerRole && d.collaborations && d.collaborations.length > 0) {
        content += `<br/><br/><strong>Top Collaborations:</strong><br/>`;
        content += d.collaborations.join("<br/>");
      }

      // Show general collaboration info for artists if available
      if (roles.includes('artist') && d.collaborations && d.collaborations.length > 0) {
        content += `<br/><br/><strong>Recent Collaborations:</strong><br/>`;
        content += d.collaborations.slice(0, 3).join("<br/>");
      }

      if (roles.includes('artist')) {
        content += `<br/><br/><em>Click to search on Music Nerd</em>`;
        
        // Add note about right-click for non-primary artists
        const mainArtistNode = data.nodes.find(node => node.size === 20 && node.type === 'artist');
        if (d !== mainArtistNode) {
          content += `<br/><em>Right-click to view ${d.name}'s network</em>`;
        }
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

    async function openMusicNerdProfile(artistName: string, artistId?: string | null) {
      // If no specific artist ID provided, check for multiple options
      if (!artistId) {
        try {
          const response = await fetch(`/api/artist-options/${encodeURIComponent(artistName)}`);
          const data = await response.json();
          
          if (data.options && data.options.length > 1) {
            // Multiple artists found - show selection modal
            console.log(`🎵 Multiple artists found for "${artistName}", showing selection modal`);
            setSelectedArtistName(artistName);
            setShowArtistModal(true);
            return;
          } else if (data.options && data.options.length === 1) {
            // Single artist found - use its ID
            artistId = data.options[0].id;
            console.log(`🎵 Single artist found for "${artistName}": ${artistId}`);
          }
        } catch (error) {
          console.error(`Error fetching artist options for "${artistName}":`, error);
        }
      }
      
      // Use artist ID if available, otherwise go to main page
      let musicNerdUrl = `https://music-nerd-git-staging-musicnerd.vercel.app/`;
      
      if (artistId) {
        musicNerdUrl = `https://music-nerd-git-staging-musicnerd.vercel.app/artist/${artistId}`;
        console.log(`🎵 Opening MusicNerd artist page for "${artistName}": ${musicNerdUrl}`);
      } else {
        console.log(`🎵 No artist ID found for "${artistName}", opening main MusicNerd page`);
      }
      
      // Create a temporary link element and click it - this approach is less likely to be blocked
      const link = document.createElement('a');
      link.href = musicNerdUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Drag functions removed - using full map panning instead

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
      tooltip.remove();
      simulation.stop();
    };
  }, [data, visible, onZoomChange]);

  // Helper function to check if a node should be visible based on filter state
  // For multi-role nodes, they are visible if ANY of their roles should be shown
  const isNodeVisible = (node: NetworkNode, filterState: FilterState): boolean => {
    if (!node.types || node.types.length === 0) {
      // Fallback to single type if types array is not available
      if (node.type === "producer" && !filterState.showProducers) return false;
      if (node.type === "songwriter" && !filterState.showSongwriters) return false;
      if (node.type === "artist" && !filterState.showArtists) return false;
      return true;
    }
    
    // Check if any of the node's roles should be visible
    for (const role of node.types) {
      if (role === "producer" && filterState.showProducers) return true;
      if (role === "songwriter" && filterState.showSongwriters) return true;
      if (role === "artist" && filterState.showArtists) return true;
    }
    
    return false;
  };

  // Update visibility based on filter state
  useEffect(() => {
    if (!svgRef.current || !visible) return;

    const svg = d3.select(svgRef.current);

    // Helper function to check if a node should be visible based on filter state
    // For multi-role nodes, they are visible if ANY of their roles should be shown
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

  const handleArtistSelection = (artistId: string) => {
    // Open the specific artist page with the selected ID
    const musicNerdUrl = `https://music-nerd-git-staging-musicnerd.vercel.app/artist/${artistId}`;
    console.log(`🎵 Opening selected artist page: ${musicNerdUrl}`);
    
    const link = document.createElement('a');
    link.href = musicNerdUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        case "recenter":
          handleRecenter();
          break;
        case "move":
          handleMove(event.detail.direction);
          break;
      }
    };

    const handleRecenter = () => {
      if (!zoomRef.current || !svgRef.current) return;

      const svg = d3.select(svgRef.current);
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Find the main artist node (largest artist node, or first artist if sizes are equal)
      const mainArtistNode = data.nodes.find(node => node.size === 20 && node.type === 'artist') ||
                           data.nodes.find(node => node.type === 'artist');

      if (mainArtistNode && mainArtistNode.x !== undefined && mainArtistNode.y !== undefined) {
        // Calculate transform to center the main artist
        const centerX = width / 2;
        const centerY = height / 2;
        const translateX = centerX - mainArtistNode.x * currentZoom;
        const translateY = centerY - mainArtistNode.y * currentZoom;

        // Apply smooth transition to center
        svg.transition()
           .duration(750)
           .call(zoomRef.current.transform, d3.zoomIdentity
             .translate(translateX, translateY)
             .scale(currentZoom)
           );
      }
    };

    const handleMove = (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!zoomRef.current || !svgRef.current) return;

      const svg = d3.select(svgRef.current);
      const moveDistance = 100; // Distance to move in pixels
      
      // Get current transform
      const currentTransform = d3.zoomTransform(svg.node()!);
      
      let newX = currentTransform.x;
      let newY = currentTransform.y;
      
      // Calculate new position based on direction
      // Note: When moving the camera view "up", we translate the content down (negative Y)
      // This creates the effect of the camera looking up at the content
      switch (direction) {
        case 'up':
          newY += moveDistance; // Move content down = camera looks up
          break;
        case 'down':
          newY -= moveDistance; // Move content up = camera looks down
          break;
        case 'left':
          newX += moveDistance; // Move content right = camera looks left
          break;
        case 'right':
          newX -= moveDistance; // Move content left = camera looks right
          break;
      }
      
      // Apply smooth transition to new position
      svg.transition()
         .duration(300)
         .call(zoomRef.current.transform, d3.zoomIdentity
           .translate(newX, newY)
           .scale(currentTransform.k)
         );
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
      
      <ArtistSelectionModal
        isOpen={showArtistModal}
        onClose={() => setShowArtistModal(false)}
        artistName={selectedArtistName}
        onSelectArtist={handleArtistSelection}
      />
    </div>
  );
}
