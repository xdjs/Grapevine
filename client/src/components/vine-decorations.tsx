import * as d3 from 'd3';
import { NetworkNode, NetworkLink } from '../types/network';

/**
 * Vine decoration manager for leaves and grapes
 */
export class VineDecorations {
  private defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null;
  private onGrapeClick?: (data: {
    linkIndex: number;
    clusterIndex: number;
    grapeIndex: number;
    sourceArtist: string;
    targetArtist: string;
  }) => void;
  private grapesVisible: boolean = false;

  /**
   * Set the grape click callback
   */
  setGrapeClickCallback(callback: (data: {
    linkIndex: number;
    clusterIndex: number;
    grapeIndex: number;
    sourceArtist: string;
    targetArtist: string;
  }) => void) {
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Setting grape click callback`);
    this.onGrapeClick = callback;
  }

  /**
   * Show grapes after OpenAI content is generated
   */
  showGrapes() {
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] showGrapes called, setting grapesVisible to true`);
    this.grapesVisible = true;
    // Trigger a re-render of grapes if they exist
    if (this.defs) {
      const svg = this.defs.node()?.parentElement;
      if (svg) {
        const grapeClusters = d3.select(svg).selectAll('.grape-cluster');
        const clusterCount = grapeClusters.size();
        console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Found ${clusterCount} grape clusters, setting opacity to 1`);
        grapeClusters.style('opacity', 1);
        
        // Add click handlers to all existing grapes now that they're visible
        const grapeCircles = d3.select(svg).selectAll('.grape');
        const grapeCount = grapeCircles.size();
        console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Adding click handlers to ${grapeCount} grape circles`);
        
        grapeCircles.each((d, i, nodes) => {
          const grapeCircle = d3.select(nodes[i]);
          const grapeGroup = grapeCircle.select(function() { return this.parentNode; });
          const clusterGroup = grapeGroup.select(function() { return this.parentNode; });
          const linkGroup = clusterGroup.select(function() { return this.parentNode; });
          
          // Extract data from the DOM structure
          const linkIndex = parseInt(linkGroup.attr('data-link-index') || '0');
          const clusterIndex = parseInt(clusterGroup.attr('data-cluster-index') || '0');
          const grapeIndex = parseInt(grapeGroup.attr('data-grape-index') || '0');
          const linkData = linkGroup.datum() as NetworkLink;
          
          // Add click handler and pointer cursor
          grapeCircle
            .style('cursor', 'pointer')
            .on('click', (event) => {
              // Immediately prevent all event propagation
              event.stopPropagation();
              event.preventDefault();
              event.stopImmediatePropagation();
              
              // Call the grape click handler
              this.handleGrapeClick(event, grapeGroup, linkIndex, clusterIndex, grapeIndex, linkData);
            })
            .on('mousedown', (event) => {
              // Prevent any mouse events that might trigger zoom
              event.stopPropagation();
              event.preventDefault();
              event.stopImmediatePropagation();
            })
            .on('mouseup', (event) => {
              // Prevent any mouse events that might trigger zoom
              event.stopPropagation();
              event.preventDefault();
              event.stopImmediatePropagation();
            });
        });
        
        console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Grapes are now visible and clickable in the SVG`);
      } else {
        console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] No SVG parent found for defs`);
      }
    } else {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] No defs available, cannot show grapes`);
    }
  }

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
      .attr("dx", "0.5")
      .attr("dy", "0.5")
      .attr("stdDeviation", "0.5")
      .attr("flood-color", "#000000")
      .attr("flood-opacity", "0.4");
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
        .attr("data-leaf-index", i)
        .style("cursor", "pointer") // Add pointer cursor to indicate clickability
        .on("click", (event) => this.handleLeafClick(event, leafGroup, linkIndex, i));
      
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
   * Handle grape click event and trigger popup
   */
  private handleGrapeClick(
    event: MouseEvent,
    grapeGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    linkIndex: number,
    clusterIndex: number,
    grapeIndex: number,
    linkData: NetworkLink
  ) {
    // Prevent event bubbling and default behavior to avoid zoom reset
    event.stopPropagation();
    event.preventDefault();
    event.stopImmediatePropagation();
    
    // Also prevent any custom events that might be triggered
    event.stopImmediatePropagation();
    
    // Log the event details for debugging
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Grape clicked: link ${linkIndex}, cluster ${clusterIndex}, grape ${grapeIndex}`, {
      eventType: event.type,
      target: event.target,
      currentTarget: event.currentTarget,
      defaultPrevented: event.defaultPrevented,
      bubbles: event.bubbles,
      cancelable: event.cancelable
    });
    
    // Call the callback if it exists
    if (this.onGrapeClick) {
      const sourceArtist = typeof linkData.source === 'string' ? linkData.source : linkData.source.name;
      const targetArtist = typeof linkData.target === 'string' ? linkData.target : linkData.target.name;
      
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Calling grape click callback with data:`, {
        linkIndex,
        clusterIndex,
        grapeIndex,
        sourceArtist,
        targetArtist
      });
      
      this.onGrapeClick({
        linkIndex,
        clusterIndex,
        grapeIndex,
        sourceArtist,
        targetArtist
      });
    } else {
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] No grape click callback registered`);
    }
  }

  /**
   * Handle leaf click event and trigger shaking animation
   */
  private handleLeafClick(
    event: MouseEvent, 
    leafGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    linkIndex: number,
    leafIndex: number
  ) {
    event.stopPropagation(); // Prevent event bubbling
    
    // Prevent multiple animations on the same leaf
    if (leafGroup.classed("shaking")) {
      return;
    }
    
    console.log(`🍃 [VineDecorations] Leaf clicked: link ${linkIndex}, leaf ${leafIndex}`);
    
    // Add shaking class to prevent multiple animations
    leafGroup.classed("shaking", true);
    
    // Get the current transform of the leaf group
    const currentTransform = leafGroup.attr("transform") || "";
    
    // Create shaking animation
    const shakeDuration = 600; // 600ms total animation
    const shakeIntensity = 2; // 2px shake distance
    const shakeSteps = 6; // Number of shake movements
    
    // Create keyframe animation using D3 transitions
    let shakeCount = 0;
    const shake = () => {
      if (shakeCount >= shakeSteps) {
        // End animation - restore original position
        leafGroup
          .transition()
          .duration(100)
          .attr("transform", currentTransform)
          .on("end", () => {
            leafGroup.classed("shaking", false);
          });
        return;
      }
      
      // Calculate shake offset
      const progress = shakeCount / shakeSteps;
      const intensity = shakeIntensity * (1 - progress); // Decreasing intensity
      const angle = (shakeCount % 2 === 0 ? 1 : -1) * intensity;
      
      // Apply shake transform
      leafGroup
        .transition()
        .duration(shakeDuration / shakeSteps)
        .attr("transform", `${currentTransform} translate(${angle}, ${angle * 0.5})`)
        .on("end", () => {
          shakeCount++;
          shake();
        });
    };
    
    // Start the shake animation
    shake();
  }

  /**
   * Create grape clusters for a link group
   */
  createGrapes(
    linkGroup: d3.Selection<SVGGElement, NetworkLink, SVGGElement, unknown>,
    linkIndex: number
  ) {
    const linkData = linkGroup.datum();
    const sourceArtist = typeof linkData.source === 'string' ? linkData.source : linkData.source.name;
    const targetArtist = typeof linkData.target === 'string' ? linkData.target : linkData.target.name;
    
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Creating grapes for link ${linkIndex}: ${sourceArtist} → ${targetArtist}`);
    
    // Store link index in the link group for later reference
    linkGroup.attr("data-link-index", linkIndex.toString());
    
    // First, create a leaf on this line (always visible)
    this.createLeaf(linkGroup, linkIndex, linkData.source, linkData.target);
    
    const seed = `${linkData.source}_${linkData.target}_${linkIndex}`;
    const hash = seed.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Create exactly one grape cluster per line
    const grapeClusterCount = 1;
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Will create ${grapeClusterCount} grape cluster for link ${linkIndex}`);
    
    for (let clusterIndex = 0; clusterIndex < grapeClusterCount; clusterIndex++) {
      const clusterSeed = Math.abs(linkIndex * 1000 + clusterIndex * 100);
      const grapesInCluster = 3 + (clusterSeed % 3); // 3-5 grapes per cluster
      
      // Create cluster group
      const clusterGroup = linkGroup.append("g")
        .attr("class", "grape-cluster")
        .attr("data-cluster-index", clusterIndex)
        .style("opacity", this.grapesVisible ? 1 : 0) // Initially hidden
        .on("click", (event) => {
          // Prevent any click events on the cluster group from bubbling up
          event.stopPropagation();
          event.preventDefault();
        });
      
      console.log(`🕐 [${new Date().toISOString()}] 🍇 [VineDecorations] Created grape cluster ${clusterIndex} with ${grapesInCluster} grapes, opacity: ${this.grapesVisible ? 1 : 0}`);
      
      // Create conical grape arrangement
      let grapeIndex = 0;
      for (let row = 0; row < grapesInCluster; row++) {
        const grapesInRow = grapesInCluster - row; // Decreasing grapes per row for conical shape
        
        for (let grapeInRow = 0; grapeInRow < grapesInRow; grapeInRow++) {
          const grapeGroup = clusterGroup.append("g")
            .attr("class", "grape-item")
            .attr("data-grape-index", grapeIndex)
            .attr("data-row", row)
            .attr("data-grape-in-row", grapeInRow)
            .on("click", (event) => {
              // Prevent any click events on the grape group from bubbling up
              event.stopPropagation();
              event.preventDefault();
            });
          
          // Create individual grape
          const grapeCircle = grapeGroup.append("circle")
            .attr("class", "grape")
            .attr("fill", "#6A4C93") // Purple grape color
            .attr("stroke", "#4A2E6B") // Darker purple outline
            .attr("stroke-width", 0.5) // Thicker stroke for better visibility
            .style("opacity", 1.0) // Full opacity for better visibility
            .style("filter", "url(#grape-shadow)")
            .style("cursor", this.grapesVisible ? "pointer" : "default") // Only show pointer cursor when visible
            .style("z-index", "15"); // Ensure individual grapes appear above everything
          
          // Only add click handler if grapes are visible
          if (this.grapesVisible) {
            grapeCircle
              .on("click", (event) => {
                // Immediately prevent all event propagation
                event.stopPropagation();
                event.preventDefault();
                event.stopImmediatePropagation();
                
                // Call the grape click handler
                this.handleGrapeClick(event, grapeGroup, linkIndex, clusterIndex, grapeIndex, linkData);
              })
              .on("mousedown", (event) => {
                // Prevent any mouse events that might trigger zoom
                event.stopPropagation();
                event.preventDefault();
                event.stopImmediatePropagation();
              })
              .on("mouseup", (event) => {
                // Prevent any mouse events that might trigger zoom
                event.stopPropagation();
                event.preventDefault();
                event.stopImmediatePropagation();
              });
          }
          
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
    
    // Also update vine leaves (the ones connected to grapes)
    this.updateLeaf(linkGroup, linkIndex, source, target);
  }

  /**
   * Create a leaf on a vine line
   */
  private createLeaf(
    linkGroup: d3.Selection<SVGGElement, NetworkLink, SVGGElement, unknown>,
    linkIndex: number,
    source: NetworkNode,
    target: NetworkNode
  ) {
    const dx = target.x! - source.x!;
    const dy = target.y! - source.y!;
    
    // Position leaf in the middle portion of the line
    const leafSeed = Math.abs(linkIndex * 1000);
    const leafPosition = 0.4 + (leafSeed % 30) / 100; // Random position between 0.4 and 0.7
    const leafX = source.x! + dx * leafPosition;
    const leafY = source.y! + dy * leafPosition;
    
    // Create leaf group
    const leafGroup = linkGroup.append("g")
      .attr("class", "vine-leaf")
      .attr("data-link-index", linkIndex.toString())
      .style("cursor", "pointer");
    
    // Create vibrant leaf shape
    const leaf = leafGroup.append("path")
      .attr("class", "leaf")
      .attr("fill", "url(#leaf-gradient)")
      .attr("stroke", "#2D5A1A")
      .attr("stroke-width", 0.25)
      .style("opacity", 1.0)
      .style("filter", "url(#leaf-shadow)");
    
    // Add leaf vein system
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
    
    // Add secondary veins
    for (let veinIndex = 0; veinIndex < 6; veinIndex++) {
      leafGroup.append("line")
        .attr("class", "leaf-vein secondary-vein")
        .attr("stroke", "#2D5A1A")
        .attr("stroke-width", 0.05)
        .style("opacity", 0.4);
    }
    
    // Position the leaf
    const leafSize = 8 + (leafSeed % 8); // 8-15px leaves
    const leafAngle = (leafSeed % 360) * Math.PI / 180; // Random rotation
    
    // Create leaf path
    const asymmetry = (leafSeed % 20 - 10) / 100;
    const leafPath = `M ${leafX} ${leafY}
                     C ${leafX + leafSize * 0.15} ${leafY - leafSize * 0.25} ${leafX + leafSize * 0.35} ${leafY - leafSize * 0.45} ${leafX + leafSize * 0.65} ${leafY - leafSize * 0.35 + asymmetry * leafSize}
                     C ${leafX + leafSize * 0.85} ${leafY - leafSize * 0.25} ${leafX + leafSize * 1.05} ${leafY - leafSize * 0.08} ${leafX + leafSize * 1.15} ${leafY + asymmetry * leafSize * 0.1}
                     C ${leafX + leafSize * 1.05} ${leafY + leafSize * 0.08} ${leafX + leafSize * 0.85} ${leafY + leafSize * 0.25} ${leafX + leafSize * 0.65} ${leafY + leafSize * 0.35 + asymmetry * leafSize}
                     C ${leafX + leafSize * 0.35} ${leafY + leafSize * 0.45} ${leafX + leafSize * 0.15} ${leafY + leafSize * 0.25} ${leafX} ${leafY}
                     Z`;
    
    leaf.attr("d", leafPath)
        .attr("transform", `rotate(${leafAngle * 180 / Math.PI}, ${leafX}, ${leafY})`);
    
    // Position veins
    mainVein.attr("x1", leafX)
            .attr("y1", leafY)
            .attr("x2", leafX + leafSize * 0.85 * Math.cos(leafAngle))
            .attr("y2", leafY + leafSize * 0.85 * Math.sin(leafAngle));
    
    // Position primary veins
    const primaryVeins = leafGroup.selectAll(".primary-vein");
    primaryVeins.each(function(veinD, veinIndex) {
      const vein = d3.select(this);
      const veinPosition = (veinIndex + 1) / 5;
      const veinStartX = leafX + veinPosition * leafSize * 0.5 * Math.cos(leafAngle);
      const veinStartY = leafY + veinPosition * leafSize * 0.5 * Math.sin(leafAngle);
      const veinEndX = veinStartX + leafSize * 0.25 * Math.cos(leafAngle + Math.PI/2);
      const veinEndY = veinStartY + leafSize * 0.25 * Math.sin(leafAngle + Math.PI/2);
      
      vein.attr("x1", veinStartX)
          .attr("y1", veinStartY)
          .attr("x2", veinEndX)
          .attr("y2", veinEndY);
    });
    
    // Position secondary veins
    const secondaryVeins = leafGroup.selectAll(".secondary-vein");
    secondaryVeins.each(function(veinD, veinIndex) {
      const vein = d3.select(this);
      const veinPosition = (veinIndex + 1) / 7;
      const veinStartX = leafX + veinPosition * leafSize * 0.6 * Math.cos(leafAngle);
      const veinStartY = leafY + veinPosition * leafSize * 0.6 * Math.sin(leafAngle);
      const veinEndX = veinStartX + leafSize * 0.18 * Math.cos(leafAngle + Math.PI/2 + (veinIndex % 2 - 0.5) * 0.3);
      const veinEndY = veinStartY + leafSize * 0.18 * Math.sin(leafAngle + Math.PI/2 + (veinIndex % 2 - 0.5) * 0.3);
      
      vein.attr("x1", veinStartX)
          .attr("y1", veinStartY)
          .attr("x2", veinEndX)
          .attr("y2", veinEndY);
    });
  }

  /**
   * Update leaf position
   */
  private updateLeaf(
    linkGroup: d3.Selection<SVGGElement, NetworkLink, SVGGElement, unknown>,
    linkIndex: number,
    source: NetworkNode,
    target: NetworkNode
  ) {
    const dx = target.x! - source.x!;
    const dy = target.y! - source.y!;
    
    // Find the leaf for this link
    const leaf = linkGroup.select(`.vine-leaf[data-link-index="${linkIndex}"]`);
    if (leaf.empty()) return;
    
    // Update leaf position
    const leafSeed = Math.abs(linkIndex * 1000);
    const leafPosition = 0.4 + (leafSeed % 30) / 100; // Random position between 0.4 and 0.7
    const leafX = source.x! + dx * leafPosition;
    const leafY = source.y! + dy * leafPosition;
    
    // Update leaf path
    const leafSize = 8 + (leafSeed % 8); // 8-15px leaves
    const leafAngle = (leafSeed % 360) * Math.PI / 180; // Random rotation
    
    const asymmetry = (leafSeed % 20 - 10) / 100;
    const leafPath = `M ${leafX} ${leafY}
                     C ${leafX + leafSize * 0.15} ${leafY - leafSize * 0.25} ${leafX + leafSize * 0.35} ${leafY - leafSize * 0.45} ${leafX + leafSize * 0.65} ${leafY - leafSize * 0.35 + asymmetry * leafSize}
                     C ${leafX + leafSize * 0.85} ${leafY - leafSize * 0.25} ${leafX + leafSize * 1.05} ${leafY - leafSize * 0.08} ${leafX + leafSize * 1.15} ${leafY + asymmetry * leafSize * 0.1}
                     C ${leafX + leafSize * 1.05} ${leafY + leafSize * 0.08} ${leafX + leafSize * 0.85} ${leafY + leafSize * 0.25} ${leafX + leafSize * 0.65} ${leafY + leafSize * 0.35 + asymmetry * leafSize}
                     C ${leafX + leafSize * 0.35} ${leafY + leafSize * 0.45} ${leafX + leafSize * 0.15} ${leafY + leafSize * 0.25} ${leafX} ${leafY}
                     Z`;
    
    leaf.select(".leaf")
      .attr("d", leafPath)
      .attr("transform", `rotate(${leafAngle * 180 / Math.PI}, ${leafX}, ${leafY})`);
    
    // Update main vein
    leaf.select(".main-vein")
      .attr("x1", leafX)
      .attr("y1", leafY)
      .attr("x2", leafX + leafSize * 0.85 * Math.cos(leafAngle))
      .attr("y2", leafY + leafSize * 0.85 * Math.sin(leafAngle));
    
    // Update primary veins
    const primaryVeins = leaf.selectAll(".primary-vein");
    primaryVeins.each(function(veinD, veinIndex) {
      const vein = d3.select(this);
      const veinPosition = (veinIndex + 1) / 5;
      const veinStartX = leafX + veinPosition * leafSize * 0.5 * Math.cos(leafAngle);
      const veinStartY = leafY + veinPosition * leafSize * 0.5 * Math.sin(leafAngle);
      const veinEndX = veinStartX + leafSize * 0.25 * Math.cos(leafAngle + Math.PI/2);
      const veinEndY = veinStartY + leafSize * 0.25 * Math.sin(leafAngle + Math.PI/2);
      
      vein.attr("x1", veinStartX)
          .attr("y1", veinStartY)
          .attr("x2", veinEndX)
          .attr("y2", veinEndY);
    });
    
    // Update secondary veins
    const secondaryVeins = leaf.selectAll(".secondary-vein");
    secondaryVeins.each(function(veinD, veinIndex) {
      const vein = d3.select(this);
      const veinPosition = (veinIndex + 1) / 7;
      const veinStartX = leafX + veinPosition * leafSize * 0.6 * Math.cos(leafAngle);
      const veinStartY = leafY + veinPosition * leafSize * 0.6 * Math.sin(leafAngle);
      const veinEndX = veinStartX + leafSize * 0.18 * Math.cos(leafAngle + Math.PI/2 + (veinIndex % 2 - 0.5) * 0.3);
      const veinEndY = veinStartY + leafSize * 0.18 * Math.sin(leafAngle + Math.PI/2 + (veinIndex % 2 - 0.5) * 0.3);
      
      vein.attr("x1", veinStartX)
          .attr("y1", veinStartY)
          .attr("x2", veinEndX)
          .attr("y2", veinEndY);
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
    
    // Update grape clusters connected to leaves
    const grapeClusters = linkGroup.selectAll(".grape-cluster");
    grapeClusters.each(function(grapeD, clusterIndex) {
      const clusterGroup = d3.select(this);
      const clusterSeed = Math.abs(linkIndex * 1000 + clusterIndex * 100);
      
      // Find the leaf for this link to position grapes connected to it
      const leaf = linkGroup.select(`.vine-leaf[data-link-index="${linkIndex}"]`);
      if (leaf.empty()) return;
      
      // Get leaf position and angle
      const leafSeed = Math.abs(linkIndex * 1000);
      const leafPosition = 0.4 + (leafSeed % 30) / 100; // Same position as leaf (0.4-0.7)
      const leafX = source.x! + dx * leafPosition;
      const leafY = source.y! + dy * leafPosition;
      const leafAngle = (leafSeed % 360) * Math.PI / 180;
      
      // Position grape cluster connected to the leaf (slightly offset from leaf)
      const grapeOffset = 15; // Distance from leaf center
      const grapeAngle = leafAngle + Math.PI / 2; // Perpendicular to leaf
      const baseX = leafX + grapeOffset * Math.cos(grapeAngle);
      const baseY = leafY + grapeOffset * Math.sin(grapeAngle);
      
      // Calculate cluster rotation and size variation
      const clusterRotation = (clusterSeed % 360) * Math.PI / 180; // 0-360 degrees
      const clusterSize = 0.8 + (clusterSeed % 40) / 100; // 0.8-1.2 size variation
      
      // Apply rotation and positioning to cluster group - connected to leaf with higher z-index
      clusterGroup
        .attr("transform", `translate(${baseX}, ${baseY}) rotate(${clusterRotation * 180 / Math.PI}) scale(${clusterSize})`)
        .style("z-index", "10"); // Ensure grapes appear above other elements
      
      // Update individual grapes within the cluster
      const grapeItems = clusterGroup.selectAll(".grape-item");
      const totalGrapesInCluster = grapeItems.size();
      
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
