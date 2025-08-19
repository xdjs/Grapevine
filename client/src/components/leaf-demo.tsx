import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function LeafDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const svgElement = svgRef.current;
    
    // Clear any existing content
    svg.selectAll("*").remove();
    
    // Set up SVG dimensions
    const width = 400;
    const height = 300;
    svg.attr("width", width).attr("height", height);
    
    // Create a simple network group
    const networkGroup = svg.append("g").attr("class", "network-group");
    
    // Create a sample link (horizontal line)
    const linkGroup = networkGroup.append("g").attr("class", "link-group");
    
    // Add the main connection line
    const linkLine = linkGroup.append("line")
      .attr("class", "link network-link")
      .attr("stroke", "#355367")
      .attr("stroke-width", 2)
      .attr("x1", 50)
      .attr("y1", 150)
      .attr("x2", 350)
      .attr("y2", 150);
    
    // Add leaf decorations
    const leafPositions = [0.33, 0.67]; // 1/3 and 2/3 along the line
    
    leafPositions.forEach((position, index) => {
      // Create leaf group
      const leafGroup = linkGroup.append("g")
        .attr("class", "leaf-decoration")
        .attr("data-leaf-index", index);
      
      // Calculate position along the line
      const leafX = 50 + (350 - 50) * position;
      const leafY = 150;
      
      // Create natural leaf shape using SVG path - more organic and nature-inspired
      const leafPath = leafGroup.append("path")
        .attr("class", "leaf-shape")
        .attr("fill", "#4ade80") // Natural green color
        .attr("stroke", "#22c55e") // Darker green border
        .attr("stroke-width", "1")
        .attr("d", "M0,0 C-3,-3 -6,-6 -9,-9 C-12,-12 -15,-15 -18,-12 C-15,-9 -12,-6 -9,-3 C-6,0 -3,3 0,6 C3,3 6,0 9,-3 C12,-6 15,-9 18,-12 C15,-15 12,-12 9,-9 C6,-6 3,-3 0,0 Z")
        .attr("transform", "scale(1.0)");
      
      // Add leaf vein details - more natural branching pattern
      const veinPath = leafGroup.append("path")
        .attr("class", "leaf-vein")
        .attr("fill", "none")
        .attr("stroke", "#16a34a") // Darker green for veins
        .attr("stroke-width", "0.8")
        .attr("d", "M0,0 C0,-3 0,-6 0,-9 C0,-12 0,-15 0,-18");
      
      // Add smaller side veins with natural branching
      const sideVein1 = leafGroup.append("path")
        .attr("class", "leaf-side-vein")
        .attr("fill", "none")
        .attr("stroke", "#16a34a")
        .attr("stroke-width", "0.6")
        .attr("d", "M-2,-4 C-3,-6 -4,-8 -6,-10 C-8,-12 -10,-14 -12,-16");
      
      const sideVein2 = leafGroup.append("path")
        .attr("class", "leaf-side-vein")
        .attr("fill", "none")
        .attr("stroke", "#16a34a")
        .attr("stroke-width", "0.6")
        .attr("d", "M2,-4 C3,-6 4,-8 6,-10 C8,-12 10,-14 12,-16");
      
      // Add additional smaller veins for more realism
      const smallVein1 = leafGroup.append("path")
        .attr("class", "leaf-small-vein")
        .attr("fill", "none")
        .attr("stroke", "#15803d")
        .attr("stroke-width", "0.4")
        .attr("d", "M-1,-2 C-2,-4 -3,-6 -4,-8");
      
      const smallVein2 = leafGroup.append("path")
        .attr("class", "leaf-small-vein")
        .attr("fill", "none")
        .attr("stroke", "#15803d")
        .attr("stroke-width", "0.4")
        .attr("d", "M1,-2 C2,-4 3,-6 4,-8");
      
      // Position the leaf group with slight rotation variation
      const leafAngle = index === 0 ? 15 : -15; // Slight variation in leaf angles
      leafGroup.attr("transform", `translate(${leafX}, ${leafY}) rotate(${leafAngle})`);
    });
    
    // Add some sample nodes
    networkGroup.append("circle")
      .attr("cx", 50)
      .attr("cy", 150)
      .attr("r", 20)
      .attr("fill", "#FF0ACF")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);
    
    networkGroup.append("circle")
      .attr("cx", 350)
      .attr("cy", 150)
      .attr("r", 20)
      .attr("fill", "#AE53FF")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);
    
    // Add labels
    networkGroup.append("text")
      .attr("x", 50)
      .attr("y", 190)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "14px")
      .text("Artist 1");
    
    networkGroup.append("text")
      .attr("x", 350)
      .attr("y", 190)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "14px")
      .text("Artist 2");
    
  }, []);

  return (
    <div className="p-8 bg-black min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">Leaf Decoration Demo</h1>
      <div className="bg-gray-900 p-4 rounded-lg">
        <svg ref={svgRef} className="w-full h-auto"></svg>
      </div>
      <div className="mt-4 text-gray-300 text-sm">
        <p>This demo shows the leaf decorations on connection lines between nodes.</p>
        <p>The leaves are positioned at 1/3 and 2/3 along the connection line.</p>
      </div>
    </div>
  );
}
