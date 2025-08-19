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
        .attr("stroke-width", "0.5")
        .attr("d", "M0,0 C-2,-2 -4,-4 -6,-6 C-8,-8 -10,-10 -12,-8 C-10,-6 -8,-4 -6,-2 C-4,0 -2,2 0,4 C2,2 4,0 6,-2 C8,-4 10,-6 12,-8 C10,-10 8,-8 6,-6 C4,-4 2,-2 0,0 Z")
        .attr("transform", "scale(0.8)");
      
      // Add leaf vein details - more natural branching pattern
      const veinPath = leafGroup.append("path")
        .attr("class", "leaf-vein")
        .attr("fill", "none")
        .attr("stroke", "#16a34a") // Darker green for veins
        .attr("stroke-width", "0.3")
        .attr("d", "M0,0 C0,-2 0,-4 0,-6 C0,-8 0,-10 0,-12");
      
      // Add smaller side veins with natural branching
      const sideVein1 = leafGroup.append("path")
        .attr("class", "leaf-side-vein")
        .attr("fill", "none")
        .attr("stroke", "#16a34a")
        .attr("stroke-width", "0.2")
        .attr("d", "M-1,-3 C-2,-4 -3,-5 -4,-6 C-5,-7 -6,-8 -7,-9");
      
      const sideVein2 = leafGroup.append("path")
        .attr("class", "leaf-side-vein")
        .attr("fill", "none")
        .attr("stroke", "#16a34a")
        .attr("stroke-width", "0.2")
        .attr("d", "M1,-3 C2,-4 3,-5 4,-6 C5,-7 6,-8 7,-9");
      
      // Add additional smaller veins for more realism
      const smallVein1 = leafGroup.append("path")
        .attr("class", "leaf-small-vein")
        .attr("fill", "none")
        .attr("stroke", "#15803d")
        .attr("stroke-width", "0.15")
        .attr("d", "M-0.5,-1.5 C-1,-2 -1.5,-2.5 -2,-3");
      
      const smallVein2 = leafGroup.append("path")
        .attr("class", "leaf-small-vein")
        .attr("fill", "none")
        .attr("stroke", "#15803d")
        .attr("stroke-width", "0.15")
        .attr("d", "M0.5,-1.5 C1,-2 1.5,-2.5 2,-3");
      
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
