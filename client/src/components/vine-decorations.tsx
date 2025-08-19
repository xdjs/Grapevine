import * as d3 from 'd3';
import { NetworkNode, NetworkLink } from '../types/network';

/**
 * Vine decoration manager for leaves and grapes
 */
export class VineDecorations {
  private defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null;

  /**
   * Initialize SVG definitions for vine decorations
   */
  initializeDefs(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
    // Create defs section with filters and gradients
    this.defs = svg.append("defs");
    
    // Add leaf shadow filter with glow effect
    const leafFilter = this.defs.append("filter")
      .attr("id", "leaf-shadow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    // Vibrant glow effect
    leafFilter.append("feDropShadow")
      .attr("dx", "0")
      .attr("dy", "0")
      .attr("stdDeviation", "1.5")
      .attr("flood-color", "#8FC069")
      .attr("flood-opacity", "0.4");
    
    // Primary shadow
    leafFilter.append("feDropShadow")
      .attr("dx", "0.5")
      .attr("dy", "0.5")
      .attr("stdDeviation", "0.5")
      .attr("flood-color", "#000000")
      .attr("flood-opacity", "0.15");
    
    // Secondary vibrant shadow for depth
    leafFilter.append("feDropShadow")
      .attr("dx", "0.2")
      .attr("dy", "0.2")
      .attr("stdDeviation", "0.3")
      .attr("flood-color", "#2D5A1A")
      .attr("flood-opacity", "0.2");
    
    // Add vibrant leaf gradient for eye-catching appearance
    const leafGradient = this.defs.append("linearGradient")
      .attr("id", "leaf-gradient")
      .attr("gradientUnits", "userSpaceOnUse");
    
    leafGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#7FB069") // Bright vibrant green at top
      .attr("stop-opacity", 1);
    
    leafGradient.append("stop")
      .attr("offset", "50%")
      .attr("stop-color", "#6BA84A") // Medium vibrant green in middle
      .attr("stop-opacity", 1);
    
    leafGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#5A9B3A") // Rich green at bottom
      .attr("stop-opacity", 1);
    
    // Add grape shadow filter
    const grapeFilter = this.defs.append("filter")
      .attr("id", "grape-shadow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    grapeFilter.append("feDropShadow")
      .attr("dx", "0.3")
      .attr("dy", "0.3")
      .attr("stdDeviation", "0.3")
      .attr("flood-color", "#000000")
      .attr("flood-opacity", "0.3");
  }

  /**
   * Create leaves for a link group
   */
  createLeaves(
    linkGroup: d3.Selection<SVGGElement, NetworkLink, SVGGElement, unknown>,
    linkIndex: number
  ) {
    const linkData = linkGroup.datum();
    const seed = `${linkData.source}_${linkData.target}_${linkIndex}`;
    const hash = seed.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const leafCount = 1 + (Math.abs(hash) % 2); // 1-2 leaves per link
    
    for (let i = 0; i < leafCount; i++) {
      const leafGroup = linkGroup.append("g")
        .attr("class", "link-leaf")
        .attr("data-leaf-index", i);
      
      // Create vibrant leaf shape with enhanced styling and gradient
      const leaf = leafGroup.append("path")
        .attr("class", "leaf")
        .attr("fill", "url(#leaf-gradient)")
        .attr("stroke", "#2D5A1A") // Brighter green outline
        .attr("stroke-width", 0.25)
        .style("opacity", 1.0)
        .style("filter", "url(#leaf-shadow)");
      
      // Add vibrant leaf vein system
      const mainVein = leafGroup.append("line")
        .attr("class", "leaf-vein main-vein")
        .attr("stroke", "#2D5A1A")
        .attr("stroke-width", 0.18)
        .style("opacity", 0.8);
      
      // Add primary side veins
      for (let veinIndex = 0; veinIndex < 4; veinIndex++) {
        leafGroup.append("line")
          .attr("class", "leaf-vein primary-vein")
          .attr("stroke", "#2D5A1A")
          .attr("stroke-width", 0.1)
          .style("opacity", 0.6);
      }
      
      // Add secondary veins for more detail
      for (let veinIndex = 0; veinIndex < 6; veinIndex++) {
        leafGroup.append("line")
          .attr("class", "leaf-vein secondary-vein")
          .attr("stroke", "#2D5A1A")
          .attr("stroke-width", 0.05)
          .style("opacity", 0.4);
      }
    }
  }

  /**
   * Create grape clusters for a link group
   */
  createGrapes(
    linkGroup: d3.Selection<SVGGElement, NetworkLink, SVGGElement, unknown>,
    linkIndex: number
  ) {
    const linkData = linkGroup.datum();
    const seed = `${linkData.source}_${linkData.target}_${linkIndex}`;
    const hash = seed.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const grapeClusterCount = 1 + (Math.abs(hash) % 3); // 1-3 grape clusters per link
    
    for (let clusterIndex = 0; clusterIndex < grapeClusterCount; clusterIndex++) {
      const clusterSeed = Math.abs(linkIndex * 1000 + clusterIndex * 100);
      const grapesInCluster = 3 + (clusterSeed % 3); // 3-5 grapes per cluster
      
      // Create cluster group
      const clusterGroup = linkGroup.append("g")
        .attr("class", "grape-cluster")
        .attr("data-cluster-index", clusterIndex);
      
      // Create conical grape arrangement
      let grapeIndex = 0;
      for (let row = 0; row < grapesInCluster; row++) {
        const grapesInRow = grapesInCluster - row; // Decreasing grapes per row for conical shape
        
        for (let grapeInRow = 0; grapeInRow < grapesInRow; grapeInRow++) {
          const grapeGroup = clusterGroup.append("g")
            .attr("class", "grape-item")
            .attr("data-grape-index", grapeIndex)
            .attr("data-row", row)
            .attr("data-grape-in-row", grapeInRow);
          
          // Create individual grape
          grapeGroup.append("circle")
            .attr("class", "grape")
            .attr("fill", "#6A4C93") // Purple grape color
            .attr("stroke", "#4A2E6B") // Darker purple outline
            .attr("stroke-width", 0.1)
            .style("opacity", 0.9)
            .style("filter", "url(#grape-shadow)");
          
          grapeIndex++;
        }
      }
    }
  }

  /**
   * Update leaf positions and properties
   */
  updateLeaves(
    linkGroup: d3.Selection<SVGGElement, NetworkLink, SVGGElement, unknown>,
    linkIndex: number,
    source: NetworkNode,
    target: NetworkNode
  ) {
    const dx = target.x! - source.x!;
    const dy = target.y! - source.y!;
    
    // Update leaves with dynamic rotations
    const leafGroups = linkGroup.selectAll(".link-leaf");
    leafGroups.each(function(leafD, leafIndex) {
      const leafGroup = d3.select(this);
      const leafPosition = (leafIndex + 1) / (leafGroups.size() + 1);
      
      // Calculate position along the link
      const t = leafPosition;
      const x = source.x! + dx * t;
      const y = source.y! + dy * t;
      
      // Dynamic leaf properties with varied rotations
      const leafSeed = Math.abs(linkIndex * 1000 + leafIndex * 100);
      const leafSize = 8 + (leafSeed % 12); // 8-19px leaves (more randomized)
      
      // Ensure leaves are never horizontal - varied rotations
      const baseRotation = (leafSeed % 360) * Math.PI / 180; // 0-360 degrees
      const leafAngleVariation = ((leafSeed >> 8) % 120 - 60) * Math.PI / 180; // ±60 degrees
      const finalAngle = baseRotation + leafAngleVariation;
      
      // Create highly realistic grape leaf shape with natural asymmetry and texture
      const asymmetry = (leafSeed % 20 - 10) / 100; // Slight asymmetry factor
      const leafPath = `M ${x} ${y}
                       C ${x + leafSize * 0.15} ${y - leafSize * 0.25} ${x + leafSize * 0.35} ${y - leafSize * 0.45} ${x + leafSize * 0.65} ${y - leafSize * 0.35 + asymmetry * leafSize}
                       C ${x + leafSize * 0.85} ${y - leafSize * 0.25} ${x + leafSize * 1.05} ${y - leafSize * 0.08} ${x + leafSize * 1.15} ${y + asymmetry * leafSize * 0.1}
                       C ${x + leafSize * 1.05} ${y + leafSize * 0.08} ${x + leafSize * 0.85} ${y + leafSize * 0.25} ${x + leafSize * 0.65} ${y + leafSize * 0.35 + asymmetry * leafSize}
                       C ${x + leafSize * 0.35} ${y + leafSize * 0.45} ${x + leafSize * 0.15} ${y + leafSize * 0.25} ${x} ${y}
                       Z`;
      
      leafGroup.select(".leaf")
        .attr("d", leafPath)
        .attr("transform", `rotate(${finalAngle * 180 / Math.PI}, ${x}, ${y})`);
      
      // Update main vein (center line of leaf) - constrained to leaf borders
      leafGroup.select(".main-vein")
        .attr("x1", x)
        .attr("y1", y)
        .attr("x2", x + leafSize * 0.85 * Math.cos(finalAngle))
        .attr("y2", y + leafSize * 0.85 * Math.sin(finalAngle));
      
      // Update primary side veins - constrained to leaf borders
      const primaryVeins = leafGroup.selectAll(".primary-vein");
      primaryVeins.each(function(veinD, veinIndex) {
        const vein = d3.select(this);
        const veinPosition = (veinIndex + 1) / 5; // Distribute along main vein
        
        // Calculate vein start and end points
        const veinStartX = x + veinPosition * leafSize * 0.5 * Math.cos(finalAngle);
        const veinStartY = y + veinPosition * leafSize * 0.5 * Math.sin(finalAngle);
        const veinEndX = veinStartX + leafSize * 0.25 * Math.cos(finalAngle + Math.PI/2);
        const veinEndY = veinStartY + leafSize * 0.25 * Math.sin(finalAngle + Math.PI/2);
        
        vein.attr("x1", veinStartX)
            .attr("y1", veinStartY)
            .attr("x2", veinEndX)
            .attr("y2", veinEndY);
      });
      
      // Update secondary veins - constrained to leaf borders
      const secondaryVeins = leafGroup.selectAll(".secondary-vein");
      secondaryVeins.each(function(veinD, veinIndex) {
        const vein = d3.select(this);
        const veinPosition = (veinIndex + 1) / 7; // Distribute along main vein
        
        // Calculate vein start and end points with slight variation
        const veinStartX = x + veinPosition * leafSize * 0.6 * Math.cos(finalAngle);
        const veinStartY = y + veinPosition * leafSize * 0.6 * Math.sin(finalAngle);
        const veinEndX = veinStartX + leafSize * 0.18 * Math.cos(finalAngle + Math.PI/2 + (veinIndex % 2 - 0.5) * 0.3);
        const veinEndY = veinStartY + leafSize * 0.18 * Math.sin(finalAngle + Math.PI/2 + (veinIndex % 2 - 0.5) * 0.3);
        
        vein.attr("x1", veinStartX)
            .attr("y1", veinStartY)
            .attr("x2", veinEndX)
            .attr("y2", veinEndY);
      });
    });
  }

  /**
   * Update grape cluster positions and properties
   */
  updateGrapes(
    linkGroup: d3.Selection<SVGGElement, NetworkLink, SVGGElement, unknown>,
    linkIndex: number,
    source: NetworkNode,
    target: NetworkNode
  ) {
    const dx = target.x! - source.x!;
    const dy = target.y! - source.y!;
    
    // Update grape clusters directly on vine lines
    const grapeClusters = linkGroup.selectAll(".grape-cluster");
    grapeClusters.each(function(grapeD, clusterIndex) {
      const clusterGroup = d3.select(this);
      const clusterSeed = Math.abs(linkIndex * 1000 + clusterIndex * 100);
      
      // Position cluster directly on vine line - no offsets
      const clusterPosition = 0.2 + (clusterIndex * 0.3); // Spread clusters out along vine
      const baseX = source.x! + dx * clusterPosition;
      const baseY = source.y! + dy * clusterPosition;
      
      // Calculate cluster rotation and size variation
      const clusterRotation = (clusterSeed % 360) * Math.PI / 180; // 0-360 degrees
      const clusterSize = 0.8 + (clusterSeed % 40) / 100; // 0.8-1.2 size variation
      
      // Apply rotation and positioning to cluster group - directly on line
      clusterGroup.attr("transform", `translate(${baseX}, ${baseY}) rotate(${clusterRotation * 180 / Math.PI}) scale(${clusterSize})`);
      
      // Update individual grapes within the cluster
      const grapeItems = clusterGroup.selectAll(".grape-item");
      grapeItems.each(function(grapeD, grapeIndex) {
        const grapeGroup = d3.select(this);
        const row = parseInt(grapeGroup.attr("data-row") || "0");
        const grapeInRow = parseInt(grapeGroup.attr("data-grape-in-row") || "0");
        
                 // Calculate conical cluster positioning with varying grape sizes
         const baseGrapeSize = 3.0; // Increased base grape size
         const grapeSeed = Math.abs(linkIndex * 1000 + clusterIndex * 100 + grapeIndex * 10);
         const grapeSize = baseGrapeSize + (grapeSeed % 12) / 10; // 3.0-4.2px varying sizes
        
        const rowSpacing = baseGrapeSize * 1.8; // Vertical spacing between rows
        const grapeSpacing = baseGrapeSize * 1.6; // Horizontal spacing between grapes
        
        // Position grapes in conical shape
        const totalGrapesInCluster = grapeItems.size();
        const grapesInRow = totalGrapesInCluster - row;
        const rowWidth = (grapesInRow - 1) * grapeSpacing;
        const startX = -rowWidth / 2; // Center the cluster
        
        const grapeX = startX + grapeInRow * grapeSpacing;
        const grapeY = row * rowSpacing;
        
        // Add slight natural variation within cluster
        const grapeOffsetX = (grapeSeed % 6 - 3) / 10; // Small random offset
        const grapeOffsetY = ((grapeSeed >> 2) % 6 - 3) / 10;
        
        const finalGrapeX = grapeX + grapeOffsetX;
        const finalGrapeY = grapeY + grapeOffsetY;
        
        grapeGroup.select(".grape")
          .attr("cx", finalGrapeX)
          .attr("cy", finalGrapeY)
          .attr("r", grapeSize);
      });
    });
  }
}
