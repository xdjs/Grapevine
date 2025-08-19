import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { NetworkData, NetworkNode, NetworkLink, FilterState } from "@/types/network";
import { UseZoomReturn } from "@/hooks/use-zoom";
import { UseNodeInteractionsReturn } from "@/hooks/use-node-interactions";
import { UseTooltipReturn } from "@/hooks/use-tooltip";
import { useFilterVisibility } from "@/hooks/use-filter-visibility";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * D3 Network Renderer Component with Leaf Decorations
 * 
 * Features:
 * - SVG setup and rendering
 * - Force simulation management
 * - Node and link rendering with multi-role support
 * - Leaf decorations on connection lines (2 leaves per connection)
 * - Connected components calculation and positioning
 * - Boundary forces and viewport constraints
 * - Filter-based visibility management
 * 
 * Leaf Decorations:
 * - Two leaves per connection line, positioned perpendicular to the line
 * - Leaves are clickable and have hover effects
 * - Positioned at the midpoint of each connection
 * - Green color scheme (#4ade80 fill, #22c55e stroke)
 */
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
  const isMobile = useIsMobile();
  
  // Track which node IDs we've already batch-preloaded to avoid re-preloading on small expansions
  const preloadedNodeIdsRef = useRef<Set<string>>(new Set());

  // Use filter visibility management hook
  const { isNodeVisible } = useFilterVisibility({
    svgRef,
    visible,
    filterState
  });

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
   * Compute the display radius for a node. All nodes except the main artist
   * are normalized to a consistent size for visual clarity on both mobile and desktop.
   */
  const getDisplayNodeSize = useCallback((node: NetworkNode): number => {
    const isMain = Boolean(
      mainArtistNode && (
        node.id === mainArtistNode.id || node.name === mainArtistNode.name
      )
    );
    
    if (isMain) {
      // Main artist keeps their original size
      return node.size;
    } else {
      // All other nodes (including expanded ones) get the exact same size
      // This ensures Paul Epworth, Adele, and all other nodes have identical sizing
      return 22; // Consistent size for all non-main artist nodes
    }
  }, [mainArtistNode]);

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
          .distance(100)
      )

      .force("charge", d3.forceManyBody().strength(-150))
      .force("collision", d3.forceCollide<NetworkNode>().radius((d) => getDisplayNodeSize(d) + 10))
      .force("boundary", boundaryForce)
      .force("centerX", d3.forceX(width / 2).strength((d) => d === mainArtist ? 0.1 : 0))
      .force("centerY", d3.forceY(height / 2).strength((d) => d === mainArtist ? 0.1 : 0));
  };

  /**
   * SVG Pattern Manager for optimized pattern creation and cleanup
   */
  const SVGPatternManager = {
    patterns: new Map<string, boolean>(),
    cleanupQueue: new Set<string>(),
    
    // Create or reuse SVG pattern for image
    createImagePattern(svgElement: SVGSVGElement, imageUrl: string, nodeId: string): string {
      const patternId = `image-pattern-${nodeId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // Check if pattern already exists
      if (this.patterns.has(patternId)) {
        return patternId;
      }
      
      // Get or create defs section
      let defs = svgElement.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.insertBefore(defs, svgElement.firstChild);
      }
      
      // Create pattern element
      const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
      pattern.setAttribute('id', patternId);
      pattern.setAttribute('patternUnits', 'userSpaceOnUse');
      pattern.setAttribute('width', '100%');
      pattern.setAttribute('height', '100%');
      
      // Create image element within pattern
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttribute('href', imageUrl);
      image.setAttribute('width', '100%');
      image.setAttribute('height', '100%');
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      image.setAttribute('crossorigin', 'anonymous');
      
      pattern.appendChild(image);
      defs.appendChild(pattern);
      
      this.patterns.set(patternId, true);
      console.log(`✨ [PatternManager] Created pattern: ${patternId}`);
      
      return patternId;
    },
    
    // Mark pattern for cleanup when no longer needed
    markForCleanup(patternId: string) {
      this.cleanupQueue.add(patternId);
    },
    
    // Clean up unused patterns to prevent memory leaks
    cleanupUnusedPatterns(svgElement: SVGSVGElement) {
      const defs = svgElement.querySelector('defs');
      if (!defs) return;
      
      let cleanedCount = 0;
      
      this.cleanupQueue.forEach((patternId) => {
        const pattern = defs.querySelector(`#${patternId}`);
        if (pattern) {
          pattern.remove();
          this.patterns.delete(patternId);
          cleanedCount++;
        }
      });
      
      this.cleanupQueue.clear();
      
      if (cleanedCount > 0) {
        console.log(`🧹 [PatternManager] Cleaned up ${cleanedCount} unused patterns`);
      }
      
      // Remove empty defs if no patterns remain
      if (defs.children.length === 0) {
        defs.remove();
      }
    },
    
    // Get pattern usage statistics
    getStats() {
      return {
        totalPatterns: this.patterns.size,
        pendingCleanup: this.cleanupQueue.size
      };
    },
    
    // Clear all patterns (for testing or reset)
    clear() {
      this.patterns.clear();
      this.cleanupQueue.clear();
    }
  };
  
  /**
   * Enhanced image loading system with lazy loading and viewport culling
   */
  const ImageLoadingManager = {
    loadedImages: new Map<string, boolean>(),
    failedImages: new Set<string>(),
    pendingImages: new Map<string, Promise<boolean>>(),
    viewportCache: new Map<string, boolean>(),
    
    // Performance settings for large networks
    LAZY_LOADING_THRESHOLD: 20, // Only show first 20 images immediately
    VIEWPORT_CULLING_ENABLED: true,
    MAX_CONCURRENT_LOADS: 3, // Limit concurrent image loads
    
    // Check if node is in viewport for performance optimization
    isNodeInViewport(node: NetworkNode, svgElement: SVGSVGElement): boolean {
      if (!this.VIEWPORT_CULLING_ENABLED || !node.x || !node.y) return true;
      
      try {
        const rect = svgElement.getBoundingClientRect();
        const zoom = d3.zoomTransform(svgElement);
        
        // Transform node coordinates to screen coordinates
        const screenX = node.x * zoom.k + zoom.x;
        const screenY = node.y * zoom.k + zoom.y;
        
        // Add margin for nodes just outside viewport
        const margin = 100;
        
        return (
          screenX >= -margin &&
          screenX <= rect.width + margin &&
          screenY >= -margin &&
          screenY <= rect.height + margin
        );
      } catch {
        return true; // Default to visible if calculation fails
      }
    },
    
    // Get optimal image size based on node size and zoom level
    getOptimalImageSize(node: NetworkNode, svgElement?: SVGSVGElement): { width: number; height: number; quality: 'low' | 'medium' | 'high' } {
      const baseSize = (getDisplayNodeSize(node) - 4) * 2; // Base image size using display size
      
      // Get current zoom level if available
      let zoomScale = 1;
      if (svgElement) {
        try {
          const transform = d3.zoomTransform(svgElement);
          zoomScale = transform.k;
        } catch {
          // Fallback to default zoom
        }
      }
      
      // Calculate effective size on screen
      const effectiveSize = baseSize * zoomScale;
      
      // Determine quality based on effective size
      let quality: 'low' | 'medium' | 'high';
      let sizeFactor: number;
      
      if (effectiveSize < 32) {
        quality = 'low';
        sizeFactor = 0.5; // Reduce size for small nodes
      } else if (effectiveSize < 64) {
        quality = 'medium';
        sizeFactor = 0.75;
      } else {
        quality = 'high';
        sizeFactor = 1;
      }
      
      const optimizedSize = Math.max(16, Math.min(128, baseSize * sizeFactor));
      
      return {
        width: optimizedSize,
        height: optimizedSize,
        quality
      };
    },
    
    // Check if image should be loaded based on priority and performance settings
    shouldLoadImage(node: NetworkNode, nodeIndex: number, svgElement?: SVGSVGElement): boolean {
      // Always load images for high-priority nodes (first few nodes)
      if (nodeIndex < this.LAZY_LOADING_THRESHOLD) return true;
      
      // For lower-priority nodes, check viewport if culling is enabled
      if (svgElement && this.VIEWPORT_CULLING_ENABLED) {
        return this.isNodeInViewport(node, svgElement);
      }
      
      return true;
    },
    
    // Preload an image and return a promise with performance optimization
    preloadImage(url: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<boolean> {
      if (this.loadedImages.has(url)) {
        return Promise.resolve(this.loadedImages.get(url)!);
      }
      
      if (this.failedImages.has(url)) {
        return Promise.resolve(false);
      }
      
      if (this.pendingImages.has(url)) {
        return this.pendingImages.get(url)!;
      }
      
      const promise = new Promise<boolean>((resolve) => {
        const img = new Image();
        
        // Set up timeout for image loading (adjust based on priority)
        const timeoutDuration = priority === 'high' ? 8000 : priority === 'normal' ? 5000 : 3000;
        const timeout = setTimeout(() => {
          console.warn(`⏰ [ImageLoader] Timeout loading image (${priority}): ${url}`);
          this.failedImages.add(url);
          resolve(false);
        }, timeoutDuration);
        
        img.onload = () => {
          clearTimeout(timeout);
          console.log(`✅ [ImageLoader] Successfully loaded: ${url}`);
          this.loadedImages.set(url, true);
          resolve(true);
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          console.warn(`❌ [ImageLoader] Failed to load: ${url}`);
          this.failedImages.add(url);
          resolve(false);
        };
        
        // Handle CORS issues by trying with crossorigin
        img.crossOrigin = 'anonymous';
        img.src = url;
      });
      
      this.pendingImages.set(url, promise);
      
      // Clean up pending promise after resolution
      promise.finally(() => {
        this.pendingImages.delete(url);
      });
      
      return promise;
    },
    
    // Optimized batch preload with concurrent limiting and prioritization
    async batchPreloadImages(
      imageData: Array<{ url: string; node: NetworkNode; priority: 'high' | 'normal' | 'low' }>, 
      maxRetries: number = 2
    ): Promise<Map<string, boolean>> {
      const results = new Map<string, boolean>();
      
      console.log(`🖼️ [ImageLoader] Starting optimized batch preload of ${imageData.length} images`);
      
      // Sort by priority (high first, then normal, then low)
      const sortedImageData = imageData.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      
      // Process in concurrent batches with limited concurrency
      const concurrentBatches = [];
      for (let i = 0; i < sortedImageData.length; i += this.MAX_CONCURRENT_LOADS) {
        const batch = sortedImageData.slice(i, i + this.MAX_CONCURRENT_LOADS);
        
        const batchPromise = Promise.all(
          batch.map(async ({ url, priority }) => {
            let success = false;
            let attempt = 0;
            
            while (!success && attempt <= maxRetries) {
              if (attempt > 0) {
                console.log(`🔄 [ImageLoader] Retry attempt ${attempt} for: ${url}`);
                // Add small delay between retries
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
              }
              
              success = await this.preloadImage(url, priority);
              attempt++;
            }
            
            results.set(url, success);
            return { url, success };
          })
        );
        
        concurrentBatches.push(batchPromise);
        
        // Small delay between concurrent batches to avoid overwhelming the browser
        if (i + this.MAX_CONCURRENT_LOADS < sortedImageData.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Wait for all batches to complete
      await Promise.all(concurrentBatches);
      
      const successCount = Array.from(results.values()).filter(Boolean).length;
      console.log(`📊 [ImageLoader] Optimized batch complete: ${successCount}/${imageData.length} images loaded successfully`);
      
      return results;
    },
    
    // Check if image is ready to display
    isImageReady(url: string): boolean {
      return this.loadedImages.get(url) === true;
    },
    
    // Check if image failed to load
    hasImageFailed(url: string): boolean {
      return this.failedImages.has(url);
    },
    
    // Clear cache (useful for testing) with memory optimization
    clearCache() {
      this.loadedImages.clear();
      this.failedImages.clear();
      this.pendingImages.clear();
      this.viewportCache.clear();
      
      // Clean up any unused image elements to free memory
      const imageElements = document.querySelectorAll('image.profile-image');
      imageElements.forEach(img => {
        if (img.parentNode) {
          const imgElement = img as SVGImageElement;
          // Only remove if not currently visible
          if (imgElement.style.opacity === '0') {
            imgElement.remove();
          }
        }
      });
      
      // Also clear SVG patterns
      SVGPatternManager.clear();
      
      console.log(`🧹 [ImageLoader] Cache cleared and ${imageElements.length} image elements cleaned up`);
    },
    
    // Performance monitoring with image quality metrics
    getPerformanceStats() {
      // Provide safe defaults for non-DOM environments (SSR/tests)
      const hasDocument = typeof document !== 'undefined';
      const qualityStats = { low: 0, medium: 0, high: 0 } as Record<'low' | 'medium' | 'high', number>;
      const imageElements = hasDocument ? document.querySelectorAll('image.profile-image[data-quality]') : ([] as any);
      if (hasDocument) {
        imageElements.forEach((img: Element) => {
          const quality = (img.getAttribute('data-quality') as 'low' | 'medium' | 'high') || undefined;
          if (quality && (quality in qualityStats)) {
            qualityStats[quality]++;
          }
        });
      }
      const hasMemory = typeof performance !== 'undefined' && (performance as any).memory;
      return {
        loadedImages: this.loadedImages.size,
        failedImages: this.failedImages.size,
        pendingImages: this.pendingImages.size,
        viewportCacheSize: this.viewportCache.size,
        imageQuality: qualityStats,
        totalRenderedImages: hasDocument ? (imageElements as NodeListOf<Element>).length : 0,
        memoryUsageMB: hasMemory ? Math.round(((performance as any).memory.usedJSHeapSize / 1024 / 1024) * 100) / 100 : 'unknown'
      };
    }
  };

  /**
   * Render node elements with multi-role support and optimized progressive image loading.
   * Single-role nodes get simple circles, multi-role nodes get segmented circles.
   * Includes performance optimizations: lazy loading, viewport culling, and memory management.
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
          .attr("r", getDisplayNodeSize(d))
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
            .innerRadius(getDisplayNodeSize(d) - 4)
            .outerRadius(getDisplayNodeSize(d))
            .startAngle(startAngle)
            .endAngle(endAngle);
          const arcD = (arcPath as unknown as () => string | null)() || '';
          group.append("path")
            .attr("d", arcD)
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
          .attr("r", getDisplayNodeSize(d) - 4)
          .attr("fill", "transparent")
          .attr("stroke", "white")
          .attr("stroke-width", 2);
      }

      // Add profile picture support for any node with an imageUrl (optimized)
      if (d.imageUrl) {
        const profileImageSize = getDisplayNodeSize(d) - 4; // Leave minimal space for border
        const nodeIndex = nodes.indexOf(d);
        const shouldLoad = ImageLoadingManager.shouldLoadImage(d, nodeIndex, svgRef.current || undefined);
        
        // Create clipPath for circular image
        const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create optimized clipPath using centralized pattern management
        const svg = svgRef.current!;
        let defs = svg.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          svg.insertBefore(defs, svg.firstChild);
        }
        
        // Check if clipPath already exists to avoid duplication
        if (!defs.querySelector(`#${clipId}`)) {
          const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
          clipPath.setAttribute('id', clipId);
          
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', '0');
          circle.setAttribute('cy', '0');
          circle.setAttribute('r', profileImageSize.toString());
          
          clipPath.appendChild(circle);
          defs.appendChild(clipPath);
        }
          
        // Add data attribute for viewport culling reference
        group.attr("data-node-id", d.id);

        // Optimized progressive loading with viewport culling
        if (!shouldLoad) {
          // For nodes outside viewport or low priority, show placeholder initially
          const placeholderGroup = group.append("g")
            .attr("class", "image-placeholder-lazy")
            .style("opacity", 0.7);
            
          placeholderGroup.append("circle")
            .attr("r", profileImageSize)
            .attr("fill", "#1a1a1a")
            .attr("stroke", "#444")
            .attr("stroke-width", 1);
            
          placeholderGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-size", "10px")
            .attr("fill", "#666")
            .text("⏳");
          
          // Mark as not in viewport initially for lazy loading
          ImageLoadingManager.viewportCache.set(d.id, false);
            
        } else if (ImageLoadingManager.isImageReady(d.imageUrl)) {
          // Mark as loaded and in viewport
          ImageLoadingManager.viewportCache.set(d.id, true);
          
          // Image is already loaded - display immediately with optimal sizing
          const optimalSize = ImageLoadingManager.getOptimalImageSize(d, svgRef.current || undefined);
          
          const image = group.append("image")
            .attr("class", "profile-image")
            .attr("data-quality", optimalSize.quality)
            .attr("x", -profileImageSize)
            .attr("y", -profileImageSize)
            .attr("width", profileImageSize * 2)
            .attr("height", profileImageSize * 2)
            .attr("clip-path", `url(#${clipId})`)
            .attr("href", d.imageUrl || '')
            .attr("crossorigin", "anonymous")
            .style("opacity", 1)
            .style("image-rendering", optimalSize.quality === 'low' ? 'pixelated' : 'auto');
            
        } else if (ImageLoadingManager.hasImageFailed(d.imageUrl)) {
          // Image has failed to load - show fallback placeholder
          const placeholderGroup = group.append("g")
            .attr("class", "image-placeholder");
            
          placeholderGroup.append("circle")
            .attr("r", profileImageSize)
            .attr("fill", "#2a2a2a")
            .attr("stroke", "#555")
            .attr("stroke-width", 1);
            
          placeholderGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-size", "12px")
            .attr("fill", "#888")
            .text("?");
            
        } else {
          // Image is not yet loaded - show loading spinner and start progressive loading
          const loadingGroup = group.append("g")
            .attr("class", "loading-spinner")
            .style("opacity", 1);
          
          // Get optimal sizing for this node
          const optimalSize = ImageLoadingManager.getOptimalImageSize(d, svgRef.current || undefined);
          
          // Enhanced loading spinner with pulsing effect (scaled appropriately)
          const spinnerSize = Math.max(6, Math.min(12, profileImageSize * 0.3));
          const spinnerCircle = loadingGroup.append("circle")
            .attr("r", spinnerSize)
            .attr("fill", "none")
            .attr("stroke", optimalSize.quality === 'high' ? "#888" : "#666")
            .attr("stroke-width", optimalSize.quality === 'high' ? 2 : 1)
            .attr("stroke-dasharray", "12.57")
            .attr("stroke-linecap", "round")
            .style("animation", "spin 1s linear infinite");
          
          // Add pulsing background circle (size-optimized)
          const bgSize = profileImageSize * (optimalSize.quality === 'high' ? 0.9 : 0.7);
          loadingGroup.append("circle")
            .attr("r", bgSize)
            .attr("fill", "rgba(255, 255, 255, 0.05)")
            .attr("stroke", "rgba(255, 255, 255, 0.1)")
            .attr("stroke-width", 1)
            .style("animation", "pulse 2s ease-in-out infinite");
          
          // Start progressive loading with priority based on node importance
          const priority = nodeIndex < ImageLoadingManager.LAZY_LOADING_THRESHOLD ? 'high' : 
                          d.type === 'artist' ? 'normal' : 'low';
          
          ImageLoadingManager.preloadImage(d.imageUrl, priority).then((success) => {
            if (success) {
              // Image loaded successfully - transition to display with optimal sizing
              const optimalSize = ImageLoadingManager.getOptimalImageSize(d, svgRef.current || undefined);
              
              const image = group.append("image")
                .attr("class", "profile-image")
                .attr("data-quality", optimalSize.quality)
                .attr("x", -profileImageSize)
                .attr("y", -profileImageSize)
                .attr("width", profileImageSize * 2)
                .attr("height", profileImageSize * 2)
                .attr("clip-path", `url(#${clipId})`)
                 .attr("href", d.imageUrl || '')
                .attr("crossorigin", "anonymous")
                .style("opacity", 0)
                .style("image-rendering", optimalSize.quality === 'low' ? 'pixelated' : 'auto');
              
              // Smooth transition from loading to image
              loadingGroup.transition()
                .duration(300)
                .style("opacity", 0)
                .on("end", () => loadingGroup.remove());
              
              image.transition()
                .duration(300)
                .style("opacity", 1);
                
            } else {
              // Image failed to load - transition to placeholder
              const placeholderGroup = group.append("g")
                .attr("class", "image-placeholder")
                .style("opacity", 0);
                
              placeholderGroup.append("circle")
                .attr("r", profileImageSize)
                .attr("fill", "#2a2a2a")
                .attr("stroke", "#555")
                .attr("stroke-width", 1);
                
              placeholderGroup.append("text")
                .attr("text-anchor", "middle")
                .attr("dy", "0.35em")
                .attr("font-size", "12px")
                .attr("fill", "#888")
                .text("?");
              
              // Smooth transition from loading to placeholder
              loadingGroup.transition()
                .duration(300)
                .style("opacity", 0)
                .on("end", () => loadingGroup.remove());
              
              placeholderGroup.transition()
                .duration(300)
                .style("opacity", 1);
            }
          }).catch((error) => {
            console.error(`❌ [ImageLoader] Error loading ${d.imageUrl}:`, error);
            // Remove loading spinner on error
            loadingGroup.transition()
              .duration(300)
              .style("opacity", 0)
              .on("end", () => loadingGroup.remove());
          });
        }
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
   * Render leaf decorations on connection lines.
   */
  const renderLeafDecorations = (
    networkGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    links: NetworkLink[]
  ) => {
    console.log(`🍃 [LeafDecorations] Rendering ${links.length} leaf decorations`);
    
    return networkGroup
      .selectAll(".leaf-decoration")
      .data(links)
      .enter()
      .append("g")
      .attr("class", "leaf-decoration")
      .each(function(d) {
        const linkGroup = d3.select(this);
        
        // Randomly decide how many leaves this connection will have (1 or 2)
        const leafCount = Math.random() > 0.4 ? 2 : 1; // 60% chance of 2 leaves, 40% chance of 1
        
        // Randomize leaf size for natural variation
        const leftLeafSize = 1.2 + Math.random() * 0.6; // 1.2x to 1.8x base size
        const rightLeafSize = 1.2 + Math.random() * 0.6; // 1.2x to 1.8x base size
        
        // Randomize leaf colors for natural variation
        const leafColors = [
          "#4ade80", // Bright green
          "#22c55e", // Medium green
          "#16a34a", // Dark green
          "#84cc16", // Lime green
          "#65a30d"  // Olive green
        ];
        const leftLeafColor = leafColors[Math.floor(Math.random() * leafColors.length)];
        const rightLeafColor = leafColors[Math.floor(Math.random() * leafColors.length)];
        
        // Create static rotation variations that won't change each tick
        const leftRotationVariation = (Math.random() - 0.5) * 20; // ±10 degrees
        const rightRotationVariation = (Math.random() - 0.5) * 20; // ±10 degrees
        
        // Create static position variations that won't change each tick
        const leftLeafPos = 0.25 + Math.random() * 0.25; // 25% to 50% along the line from source
        const rightLeafPos = 0.5 + Math.random() * 0.25; // 50% to 75% along the line from source
        
        if (leafCount >= 1) {
          // Create left leaf with teardrop shape
          linkGroup.append("path")
            .attr("class", "leaf-left")
            .attr("data-rotation-variation", leftRotationVariation) // Store for later use
            .attr("data-position-ratio", leftLeafPos) // Store position ratio
            .attr("d", `M0,0 C${2 * leftLeafSize},${-6 * leftLeafSize} ${6 * leftLeafSize},${-4 * leftLeafSize} ${10 * leftLeafSize},0 C${6 * leftLeafSize},${4 * leftLeafSize} ${2 * leftLeafSize},${6 * leftLeafSize} 0,0 Z`)
            .attr("fill", leftLeafColor)
            .attr("stroke", "#22c55e")
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseenter", function() {
              d3.select(this).attr("fill", "#16a34a").attr("stroke", "#15803d");
            })
            .on("mouseleave", function() {
              d3.select(this).attr("fill", leftLeafColor).attr("stroke", "#22c55e");
            })
            .on("click", (event) => {
              event.stopPropagation();
              console.log("🍃 [LeafDecorations] Left leaf clicked for link:", d);
              // TODO: Implement leaf click functionality
            });
        }
        
        if (leafCount >= 2) {
          // Create right leaf with teardrop shape
          linkGroup.append("path")
            .attr("class", "leaf-right")
            .attr("data-rotation-variation", rightRotationVariation) // Store for later use
            .attr("data-position-ratio", rightLeafPos) // Store position ratio
            .attr("d", `M0,0 C${2 * rightLeafSize},${-6 * rightLeafSize} ${6 * rightLeafSize},${-4 * rightLeafSize} ${10 * rightLeafSize},0 C${6 * rightLeafSize},${4 * rightLeafSize} ${2 * rightLeafSize},${6 * rightLeafSize} 0,0 Z`)
            .attr("fill", rightLeafColor)
            .attr("stroke", "#22c55e")
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseenter", function() {
              d3.select(this).attr("fill", "#16a34a").attr("stroke", "#15803d");
            })
            .on("mouseleave", function() {
              d3.select(this).attr("fill", rightLeafColor).attr("stroke", "#22c55e");
            })
            .on("click", (event) => {
              event.stopPropagation();
              console.log("🍃 [LeafDecorations] Right leaf clicked for link:", d);
              // TODO: Implement leaf click functionality
            });
        }
      });
  };

  /**
   * Render link elements.
   */
  const renderLinks = (
    networkGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    links: NetworkLink[]
  ) => {
    const linkElements = networkGroup
      .selectAll(".link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link network-link")
      .attr("stroke", "#355367")
      .attr("stroke-width", 2);
      
    // Add leaf decorations to the links
    renderLeafDecorations(networkGroup, links);
    
    return linkElements;
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
      .attr("dy", (d) => {
        // Position labels below nodes when they have profile pictures
        const hasProfilePicture = Boolean(d.imageUrl);
        return hasProfilePicture ? `${getDisplayNodeSize(d) + 18}px` : "0.35em";
      })
      .attr("font-size", (d) => {
        // Check if this is the main artist node
        const isMainArtist = mainArtistNode && (
          d.id === mainArtistNode.id || d.name === mainArtistNode.name
        );
        
        if (isMainArtist) {
          // Main artist gets larger font size
          return d.type === 'artist' ? "16px" : "14px";
        } else {
          // All other nodes (including expanded ones) get consistent smaller font size
          return d.type === 'artist' ? "12px" : "11px";
        }
      })
      .attr("font-weight", (d) => {
        // Check if this is the main artist node
        const isMainArtist = mainArtistNode && (
          d.id === mainArtistNode.id || d.name === mainArtistNode.name
        );
        
        if (isMainArtist) {
          // Main artist gets bolder font weight
          return d.type === 'artist' ? "700" : "600";
        } else {
          // All other nodes get consistent font weight
          return d.type === 'artist' ? "500" : "500";
        }
      })
      .attr("fill", "white")
      .attr("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.8)")
      .text((d) => d.name);
  };

  // Viewport-aware image loading effect for performance optimization
  useEffect(() => {
    if (!svgRef.current || !data.nodes.length || !visible) return;
    
    const updateViewportImages = () => {
      if (!ImageLoadingManager.VIEWPORT_CULLING_ENABLED) return;
      
      const svg = svgRef.current!;
      const nodesWithImages = data.nodes.filter(node => node.imageUrl);
      
      // Track which images should be visible/hidden based on viewport
      for (const node of nodesWithImages) {
        const inViewport = ImageLoadingManager.isNodeInViewport(node, svg);
        const wasInViewport = ImageLoadingManager.viewportCache.get(node.id);
        
        if (inViewport !== wasInViewport) {
          ImageLoadingManager.viewportCache.set(node.id, inViewport);
          
          // Find the corresponding image elements and update their loading priority
          const nodeGroup = svg.querySelector(`.node-group:has([data-node-id="${node.id}"])`);
          if (nodeGroup) {
            const imageElement = nodeGroup.querySelector('image.profile-image');
            const placeholderElement = nodeGroup.querySelector('.image-placeholder-lazy');
            
            if (inViewport && placeholderElement && !imageElement) {
              // Node entered viewport - start loading image
              console.log(`🔍 [ViewportCuller] Loading image for ${node.name} (entered viewport)`);
              
              if (node.imageUrl && !ImageLoadingManager.isImageReady(node.imageUrl)) {
                ImageLoadingManager.preloadImage(node.imageUrl, 'normal').then(success => {
                  if (success) {
                    // Replace placeholder with image
                    const currentPlaceholder = nodeGroup.querySelector('.image-placeholder-lazy');
                    if (currentPlaceholder) {
                      currentPlaceholder.remove();
                      
                      // Create image element
                      const group = d3.select(nodeGroup);
                      const profileImageSize = getDisplayNodeSize(node) - 4;
                      const clipId = `clip-${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
                      
                      const image = group.append("image")
                        .attr("class", "profile-image")
                        .attr("x", -profileImageSize)
                        .attr("y", -profileImageSize)
                        .attr("width", profileImageSize * 2)
                        .attr("height", profileImageSize * 2)
                        .attr("clip-path", `url(#${clipId})`)
                        .attr("href", node.imageUrl || '')
                        .attr("crossorigin", "anonymous")
                        .style("opacity", 0);
                      
                      image.transition()
                        .duration(200)
                        .style("opacity", 1);
                    }
                  }
                });
              }
            } else if (!inViewport && imageElement) {
              // Node left viewport - consider unloading image for memory optimization
              // Only unload if we have many images loaded
              const loadedImageCount = ImageLoadingManager.loadedImages.size;
              if (loadedImageCount > 30) {
                console.log(`💿 [ViewportCuller] Unloading image for ${node.name} (left viewport, memory optimization)`);
                
                imageElement.remove();
                
                // Replace with placeholder
                const group = d3.select(nodeGroup);
                const profileImageSize = getDisplayNodeSize(node) - 4;
                
                const placeholderGroup = group.append("g")
                  .attr("class", "image-placeholder-lazy")
                  .style("opacity", 0.7);
                  
                placeholderGroup.append("circle")
                  .attr("r", profileImageSize)
                  .attr("fill", "#1a1a1a")
                  .attr("stroke", "#444")
                  .attr("stroke-width", 1);
                  
                placeholderGroup.append("text")
                  .attr("text-anchor", "middle")
                  .attr("dy", "0.35em")
                  .attr("font-size", "10px")
                  .attr("fill", "#666")
                  .text("⏳");
              }
            }
          }
        }
      }
    };
    
    // Throttled viewport update function for performance
    let viewportUpdateTimeout: NodeJS.Timeout;
    const throttledViewportUpdate = () => {
      clearTimeout(viewportUpdateTimeout);
      viewportUpdateTimeout = setTimeout(updateViewportImages, 150);
    };
    
    // Set up viewport monitoring for zoom and pan events
    const svg = d3.select(svgRef.current);
    const handleViewportChange = () => {
      throttledViewportUpdate();
    };
    
    svg.on('zoom.viewport', handleViewportChange);
    
    // Initial viewport check
    updateViewportImages();
    
    return () => {
      clearTimeout(viewportUpdateTimeout);
      svg.on('zoom.viewport', null);
    };
  }, [data?.nodes, visible]);
  
  // Main D3 visualization effect
  useEffect(() => {
    console.log('🔍 [D3Renderer] Main effect triggered:', {
      hasSvgRef: !!svgRef.current,
      hasData: !!data,
      dataNodes: data?.nodes?.length || 0,
      dataLinks: data?.links?.length || 0,
      visible,
      mainArtistNode: mainArtistNode?.name
    });

    if (!svgRef.current || !data || !visible) {
      console.log('❌ [D3Renderer] Early return:', {
        noSvgRef: !svgRef.current,
        noData: !data,
        notVisible: !visible
      });
      return;
    }

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    
    console.log('🔍 [D3Renderer] Container info:', {
      container: !!container,
      containerWidth: container?.clientWidth,
      containerHeight: container?.clientHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });
    
    // Use container dimensions instead of window dimensions to avoid browser UI areas
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;

    console.log('🔍 [D3Renderer] Dimensions:', { width, height });

    // Clear existing content
    svg.selectAll("*").remove();

    // Filter out links where either node doesn't exist or is isolated
    const nodeSet = new Set(data.nodes.map(n => n.id));
    let validLinks = data.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return nodeSet.has(sourceId) && nodeSet.has(targetId);
    });
    // Do NOT override with data.links; when validLinks is empty, render no links.

    // Start optimized batch preloading of profile pictures
    // Only preload for nodes we haven't already batch-preloaded in this session
    const nodesToPreload = data.nodes.filter(node => !preloadedNodeIdsRef.current.has(node.id));
    const imagesToLoad = nodesToPreload
      .filter(node => node.imageUrl)
      .map((node, index) => ({
        url: node.imageUrl!,
        node,
        priority: index < ImageLoadingManager.LAZY_LOADING_THRESHOLD ? 'high' : 
                 node.type === 'artist' ? 'normal' : 'low' as 'high' | 'normal' | 'low'
      }))
      .filter(({ url }) => !ImageLoadingManager.isImageReady(url) && !ImageLoadingManager.hasImageFailed(url));
    
    if (imagesToLoad.length > 0) {
      console.log(`🚀 [D3Renderer] Starting optimized batch preload of ${imagesToLoad.length} profile pictures`);
      console.log(`📊 [D3Renderer] Performance stats before loading:`, ImageLoadingManager.getPerformanceStats());
      
      ImageLoadingManager.batchPreloadImages(imagesToLoad).then(() => {
        console.log(`✅ [D3Renderer] Optimized batch preload complete`);
        console.log(`📊 [D3Renderer] Performance stats after loading:`, ImageLoadingManager.getPerformanceStats());
        // Mark these nodes as preloaded to prevent future batch preloads for the same set
        for (const { node } of imagesToLoad) {
          preloadedNodeIdsRef.current.add(node.id);
        }
      }).catch(error => {
        console.error(`❌ [D3Renderer] Batch preload error:`, error);
      });
    }

    // Create network group
    const networkGroup = svg.append("g").attr("class", "network-group");
    console.log('🔍 [D3Renderer] Created network group');

    // Setup zoom behavior using the zoom hook
    zoom.setupZoomBehavior(networkGroup);
    console.log('🔍 [D3Renderer] Setup zoom behavior');

    // Add background click handler to hide tooltip and reset highlighting
    svg.on("click", function(event) {
      // Only trigger if clicking on the background (not on a node)
      if (event.target === this || event.target.tagName === 'svg') {
        tooltip.hideTooltip();
      }
    });

    // Find connected components for cluster positioning
    const components = findConnectedComponents(data.nodes, validLinks);
    console.log('🔍 [D3Renderer] Found components:', components.length);
    
    // Position components in a grid layout to prevent overlap
    positionComponents(components, width, height, mainArtistNode);
    console.log('🔍 [D3Renderer] Positioned components');

    // Create and configure D3 simulation
    const simulation = createSimulation(data.nodes, validLinks, width, height, mainArtistNode);
    console.log('🔍 [D3Renderer] Created simulation');
    (simulationRef as unknown as React.MutableRefObject<d3.Simulation<NetworkNode, NetworkLink> | null>).current = simulation;

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
    
    console.log('🔍 [D3Renderer] Rendered elements:', {
      links: linkElements.size(),
      nodes: nodeElements.size(),
      labels: labelElements.size()
    });

    // Update positions on tick
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as NetworkNode).x!)
        .attr("y1", (d) => (d.source as NetworkNode).y!)
        .attr("x2", (d) => (d.target as NetworkNode).x!)
        .attr("y2", (d) => (d.target as NetworkNode).y!);

      // Update leaf decoration positions
      const leafDecorations = networkGroup.selectAll(".leaf-decoration");
      if (leafDecorations.size() > 0) {
        console.log(`🍃 [LeafDecorations] Updating positions for ${leafDecorations.size()} leaf decorations`);
        
        leafDecorations.each(function(d) {
          const link = d as NetworkLink;
          const source = link.source as NetworkNode;
          const target = link.target as NetworkNode;
          
          if (source.x !== undefined && source.y !== undefined && 
              target.x !== undefined && target.y !== undefined) {
            
                      // Calculate positions along the connection line for leaf distribution
          // Use stored position ratios to prevent leaves from moving along the lines
          let leftX = 0, leftY = 0, rightX = 0, rightY = 0;
          
          // Get left leaf position if it exists
          const leftLeaf = leafGroup.select(".leaf-left");
          if (!leftLeaf.empty()) {
            const leftLeafPos = parseFloat(leftLeaf.attr("data-position-ratio") || "0.35");
            leftX = source.x + (target.x - source.x) * leftLeafPos;
            leftY = source.y + (target.y - source.y) * leftLeafPos;
          }
          
          // Get right leaf position if it exists
          const rightLeaf = leafGroup.select(".leaf-right");
          if (!rightLeaf.empty()) {
            const rightLeafPos = parseFloat(rightLeaf.attr("data-position-ratio") || "0.65");
            rightX = source.x + (target.x - source.x) * rightLeafPos;
            rightY = source.y + (target.y - source.y) * rightLeafPos;
          }
          
          // Calculate the angle of the connection line
          const angle = Math.atan2(target.y - source.y, target.x - source.x);
          
          // Position leaves very close to the line so they appear to stem from it
          const offset = 2; // Very small offset so leaves appear to grow from the line
          
          // Position left leaf (perpendicular to the left of the line)
          const leftAngle = angle + Math.PI / 2;
          const leftLeafX = leftX + Math.cos(leftAngle) * offset;
          const leftLeafY = leftY + Math.sin(leftAngle) * offset;
          
          // Position right leaf (perpendicular to the right of the line)
          const rightAngle = angle - Math.PI / 2;
          const rightLeafX = rightX + Math.cos(rightAngle) * offset;
          const rightLeafY = rightY + Math.sin(rightAngle) * offset;
            
                      // Update leaf positions and rotations
          const leafGroup = d3.select(this);
          
          // Update left leaf position and rotation (if it exists)
          const leftLeaf = leafGroup.select(".leaf-left");
          if (!leftLeaf.empty()) {
            // Use the stored rotation variation to prevent twitching
            const leftRotationVariation = parseFloat(leftLeaf.attr("data-rotation-variation") || "0");
            leftLeaf.attr("transform", `translate(${leftLeafX}, ${leftLeafY}) rotate(${(leftAngle * 180 / Math.PI) + 90 + leftRotationVariation})`);
          }
          
          // Update right leaf position and rotation (if it exists)
          const rightLeaf = leafGroup.select(".leaf-right");
          if (!rightLeaf.empty()) {
            // Use the stored rotation variation to prevent twitching
            const rightRotationVariation = parseFloat(rightLeaf.attr("data-rotation-variation") || "0");
            rightLeaf.attr("transform", `translate(${rightLeafX}, ${rightLeafY}) rotate(${(rightAngle * 180 / Math.PI) + 90 + rightRotationVariation})`);
          }
          }
        });
      }

      nodeElements.attr("transform", (d) => `translate(${d.x!}, ${d.y!})`);

      labelElements.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });
    
    console.log('🔍 [D3Renderer] Setup tick handler');
    
    // Start the simulation
    simulation.alpha(1).restart();
    console.log('🔍 [D3Renderer] Started simulation');

    // Enhanced cleanup function with comprehensive memory optimization
    return () => {
      simulation.stop();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      
      // Performance optimization: Clean up resources when component unmounts
      if (data.nodes.length > 50) {
        console.log(`🧹 [D3Renderer] Cleaning up large network (${data.nodes.length} nodes)`);
        
        // Clean up patterns and cache
        if (svgRef.current) {
          SVGPatternManager.cleanupUnusedPatterns(svgRef.current);
        }
        ImageLoadingManager.clearCache();
        
        console.log(`📊 [D3Renderer] Final cleanup stats:`, {
          patterns: SVGPatternManager.getStats(),
          images: ImageLoadingManager.getPerformanceStats()
        });
      }
    };
  }, [data, visible, mainArtistNode, zoom, nodeInteractions, tooltip, simulationRef, svgRef]);

  // This component doesn't render JSX, it only manages D3 DOM manipulation
  return null;
}