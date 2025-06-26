import { useEffect, useRef } from "react";
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

    // Create zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        const { transform } = event;
        networkGroup.attr("transform", transform);
        onZoomChange({ k: transform.k, x: transform.x, y: transform.y });
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Create simulation
    const simulation = d3
      .forceSimulation<NetworkNode>(data.nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(validLinks)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<NetworkNode>().radius((d) => d.size + 5));

    simulationRef.current = simulation;

    // Create links
    const linkElements = networkGroup
      .selectAll(".link")
      .data(validLinks)
      .enter()
      .append("line")
      .attr("class", "link network-link")
      .attr("stroke-width", 2);

    // Create nodes
    const nodeElements = networkGroup
      .selectAll(".node")
      .data(data.nodes)
      .enter()
      .append("circle")
      .attr("class", (d) => `node network-node node-${d.type}`)
      .attr("r", (d) => d.size)
      .on("mouseover", showTooltip)
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip)
      .call(
        d3
          .drag<SVGCircleElement, NetworkNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    // Add labels for main nodes (size >= 15)
    const labelElements = networkGroup
      .selectAll(".label")
      .data(data.nodes.filter((d) => d.size >= 15))
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .attr("fill", "white")
      .attr("pointer-events", "none")
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

    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, NetworkNode, unknown>, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, NetworkNode, unknown>, d: NetworkNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, NetworkNode, unknown>, d: NetworkNode) {
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
      return getNodeVisibility(d, filterState) ? 1 : 0;
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

  // Handle zoom controls
  useEffect(() => {
    const handleZoomEvent = (event: CustomEvent) => {
      if (!zoomRef.current || !svgRef.current) return;

      const svg = d3.select(svgRef.current);
      const { action } = event.detail;

      switch (action) {
        case "in":
          svg.transition().duration(300).call(
            zoomRef.current.scaleBy,
            1.5
          );
          break;
        case "out":
          svg.transition().duration(300).call(
            zoomRef.current.scaleBy,
            1 / 1.5
          );
          break;
        case "reset":
          svg.transition().duration(500).call(
            zoomRef.current.transform,
            d3.zoomIdentity
          );
          break;
      }
    };

    window.addEventListener("network-zoom", handleZoomEvent as EventListener);
    return () => {
      window.removeEventListener("network-zoom", handleZoomEvent as EventListener);
    };
  }, [visible]);

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
