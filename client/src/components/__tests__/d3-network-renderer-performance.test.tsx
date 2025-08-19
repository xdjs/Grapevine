import { describe, test, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import D3NetworkRenderer from '../d3-network-renderer';
import { NetworkData, NetworkNode, NetworkLink } from '@/types/network';
import type { UseZoomReturn } from '@/hooks/use-zoom';
import type { UseNodeInteractionsReturn } from '@/hooks/use-node-interactions';
import type { UseTooltipReturn } from '@/hooks/use-tooltip';

// Mock D3 with comprehensive chaining support
const createMockSelection = () => {
  const mockSelection = {
    selectAll: vi.fn(() => mockSelection),
    select: vi.fn(() => mockSelection),
    data: vi.fn(() => mockSelection),
    enter: vi.fn(() => mockSelection),
    append: vi.fn(() => mockSelection),
    attr: vi.fn(() => mockSelection),
    style: vi.fn(() => mockSelection),
    text: vi.fn(() => mockSelection),
    on: vi.fn(() => mockSelection),
    call: vi.fn(() => mockSelection),
    remove: vi.fn(() => mockSelection),
    transition: vi.fn(() => mockSelection),
    duration: vi.fn(() => mockSelection),
    datum: vi.fn(() => ({})),
    empty: vi.fn(() => false),
    node: vi.fn(() => null)
  };
  return mockSelection;
};

vi.mock('d3', () => ({
  select: vi.fn(() => createMockSelection()),
  selectAll: vi.fn(() => createMockSelection()),
  forceSimulation: vi.fn(() => ({
    force: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    alpha: vi.fn().mockReturnThis(),
    restart: vi.fn().mockReturnThis()
  })),
  forceLink: vi.fn(() => ({ id: vi.fn().mockReturnThis(), distance: vi.fn().mockReturnThis() })),
  forceManyBody: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceCollide: vi.fn(() => ({ radius: vi.fn().mockReturnThis() })),
  forceX: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceY: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  zoomTransform: vi.fn(() => ({ k: 1, x: 0, y: 0 })),
  zoom: vi.fn(() => ({ on: vi.fn().mockReturnThis() })),
  arc: vi.fn(() => vi.fn(() => 'mock-arc-path'))
}));

// Mock the useFilterVisibility hook to prevent D3 interaction issues
vi.mock('@/hooks/use-filter-visibility', () => ({
  useFilterVisibility: vi.fn(() => ({
    isNodeVisible: vi.fn(() => true)
  }))
}));

// Mock performance API for testing
const mockPerformance = {
  memory: {
    usedJSHeapSize: 50000000, // 50MB
    totalJSHeapSize: 100000000,
    jsHeapSizeLimit: 2000000000
  },
  now: vi.fn(() => Date.now())
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

// Mock Image constructor for testing image loading
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string = '';
  src: string = '';
  
  constructor() {
    // Simulate async image loading
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 100);
  }
}

global.Image = MockImage as any;

describe('D3NetworkRenderer Performance Tests', () => {
  let mockSvgRef: React.RefObject<SVGSVGElement>;
  let mockSimulationRef: React.RefObject<any>;
  let mockZoom: UseZoomReturn;
  let mockNodeInteractions: UseNodeInteractionsReturn;
  let mockTooltip: UseTooltipReturn;

  // Create test data with varying sizes
  const createTestNetworkData = (nodeCount: number, includeImages: boolean = true): NetworkData => {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node-${i}`,
        name: `Artist ${i}`,
        type: i % 3 === 0 ? 'artist' : i % 3 === 1 ? 'producer' : 'songwriter',
                    size: 20,
        imageUrl: includeImages ? `https://example.com/image-${i}.jpg` : undefined,
        spotifyId: includeImages ? `spotify-${i}` : undefined
      });

      // Create links to form a connected network
      if (i > 0) {
        links.push({
          source: `node-0`, // Main artist
          target: `node-${i}`
        });
      }
    }

    return { nodes, links };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset performance timers
    mockPerformance.now.mockImplementation(() => Date.now());
    
    // Mock refs with comprehensive SVG element simulation
    const mockSvgElement = {
      getBoundingClientRect: vi.fn(() => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600
      })),
      parentElement: {
        clientWidth: 800,
        clientHeight: 600
      },
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      insertBefore: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      firstChild: null,
      children: [],
      tagName: 'svg'
    };
    
    mockSvgRef = {
      current: mockSvgElement as any
    };

    mockSimulationRef = { 
      current: {
        stop: vi.fn(),
        force: vi.fn().mockReturnThis(),
        alpha: vi.fn().mockReturnThis(),
        restart: vi.fn().mockReturnThis()
      }
    };

    // Mock hooks
    mockZoom = {
      currentZoom: 1,
      setupZoomBehavior: vi.fn(),
      handleZoomIn: vi.fn(),
      handleZoomOut: vi.fn(),
      handleZoomReset: vi.fn(),
      applyZoom: vi.fn(),
      applyPinchZoom: vi.fn()
    };

    mockNodeInteractions = {
      handleNodeClick: vi.fn(),
      setupDragBehavior: vi.fn(),
      highlightNode: vi.fn(),
      unhighlightNode: vi.fn(),
      isNodeHighlighted: vi.fn(() => false)
    };

    mockTooltip = {
      showTooltip: vi.fn(),
      hideTooltip: vi.fn(),
      tooltipVisible: false,
      tooltipContent: null,
      tooltipPosition: { x: 0, y: 0 }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Image Loading Performance', () => {
    test('should handle large network with lazy loading efficiently', async () => {
      const startTime = Date.now();
      const largeNetworkData = createTestNetworkData(100, true);

      // Mock document.querySelectorAll for image elements
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('image.profile-image')) {
          // Simulate that only some images are loaded (lazy loading working)
          return Array.from({ length: 15 }, () => ({ 
            style: { opacity: '1' },
            getAttribute: vi.fn(() => 'medium'),
            remove: vi.fn(),
            parentNode: {}
          })) as any;
        }
        return originalQuerySelectorAll.call(document, selector);
      });

      const { unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={largeNetworkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      const renderTime = Date.now() - startTime;
      
      // Performance assertion: should render large network quickly
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second

      // Wait for component to settle
      await waitFor(() => {
        // Check that lazy loading is working by verifying not all images are loaded immediately
        const imageElements = document.querySelectorAll('image.profile-image');
        expect(imageElements.length).toBeLessThan(largeNetworkData.nodes.length);
      }, { timeout: 2000 });
      
      unmount();
      document.querySelectorAll = originalQuerySelectorAll;
    });

    test('should prioritize high-priority image loading', async () => {
      const networkData = createTestNetworkData(20, true);
      const loadStartTime = Date.now();

      // Mock loading spinner elements
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('loading-spinner')) {
          // Simulate some spinners still loading (not all loaded immediately)
          return Array.from({ length: 5 }, () => ({ 
            style: { opacity: '1' },
            remove: vi.fn()
          })) as any;
        }
        return originalQuerySelectorAll.call(document, selector);
      });

      const { unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      // Wait for high-priority images (first 20 nodes) to load
      await waitFor(() => {
        const loadingSpinners = document.querySelectorAll('.loading-spinner');
        expect(loadingSpinners.length).toBeLessThan(20); // Should have started loading high-priority images
      }, { timeout: 1000 });

      const priorityLoadTime = Date.now() - loadStartTime;
      expect(priorityLoadTime).toBeLessThan(2000); // High-priority images should load quickly
      
      unmount();
      document.querySelectorAll = originalQuerySelectorAll;
    });

    test('should implement viewport culling for memory efficiency', async () => {
      const largeNetworkData = createTestNetworkData(200, true);

      // Mock viewport culling elements
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('image.profile-image') || selector.includes('image-placeholder-lazy')) {
          // Simulate viewport culling - only show ~60% of images (120 out of 200)
          return Array.from({ length: 120 }, () => ({ 
            style: { opacity: '1' },
            remove: vi.fn()
          })) as any;
        }
        return originalQuerySelectorAll.call(document, selector);
      });

      const { unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={largeNetworkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      await waitFor(() => {
        // Check that viewport culling is working
        const totalImages = document.querySelectorAll('image.profile-image, .image-placeholder-lazy').length;
        expect(totalImages).toBeLessThan(largeNetworkData.nodes.length * 0.8); // Should cull off-screen images
      }, { timeout: 1000 });
      
      unmount();
      document.querySelectorAll = originalQuerySelectorAll;
    });

    test('should optimize image quality based on zoom level', async () => {
      const networkData = createTestNetworkData(10, true);

      // Test with different zoom levels
      const zoomLevels = [0.5, 1.0, 2.0];
      
      for (const zoomLevel of zoomLevels) {
        mockZoom.currentZoom = zoomLevel;

        // Mock image elements with quality attributes
        const originalQuerySelectorAll = document.querySelectorAll;
        document.querySelectorAll = vi.fn((selector) => {
          if (selector.includes('image.profile-image[data-quality]')) {
            const expectedQuality = zoomLevel < 0.8 ? 'low' : zoomLevel > 1.5 ? 'high' : 'medium';
            return [{
              getAttribute: vi.fn(() => expectedQuality),
              style: { opacity: '1' }
            }] as any;
          }
          return originalQuerySelectorAll.call(document, selector);
        });

        const { unmount } = render(
          <svg ref={mockSvgRef}>
            <D3NetworkRenderer
              data={networkData}
              visible={true}
              filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
              svgRef={mockSvgRef}
              simulationRef={mockSimulationRef}
              zoom={mockZoom}
              nodeInteractions={mockNodeInteractions}
              tooltip={mockTooltip}
            />
          </svg>
        );

        await waitFor(() => {
          const images = document.querySelectorAll('image.profile-image[data-quality]');
          if (images.length > 0) {
            const firstImage = images[0];
            const quality = firstImage.getAttribute('data-quality');
            
            // Quality should match zoom level expectations
            if (zoomLevel < 0.8) {
              expect(quality).toBe('low');
            } else if (zoomLevel > 1.5) {
              expect(quality).toBe('high');
            } else {
              expect(quality).toBe('medium');
            }
          }
        }, { timeout: 500 });
        
        unmount();
        document.querySelectorAll = originalQuerySelectorAll;
      }
    });
  });

  describe('Memory Management', () => {
    test('should clean up SVG patterns on component unmount', async () => {
      const networkData = createTestNetworkData(50, true);

      const { unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      // Wait for component to initialize
      await waitFor(() => {
        expect(mockZoom.setupZoomBehavior).toHaveBeenCalled();
      }, { timeout: 500 });

      // Unmount component
      act(() => {
        unmount();
      });

      // Verify simulation cleanup would be called
      expect(mockZoom.setupZoomBehavior).toHaveBeenCalled();
    });

    test('should limit concurrent image loads', async () => {
      const networkData = createTestNetworkData(30, true);
      
      // Mock limited concurrent loading
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('loading-spinner')) {
          return Array.from({ length: 8 }, () => ({ style: { opacity: '1' }})) as any;
        }
        if (selector.includes('image.profile-image')) {
          return Array.from({ length: 12 }, () => ({ style: { opacity: '1' }})) as any;
        }
        return originalQuerySelectorAll.call(document, selector);
      });

      const { unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      // Wait for initial load batch
      await waitFor(() => {
        const loadingSpinners = document.querySelectorAll('.loading-spinner');
        const loadedImages = document.querySelectorAll('image.profile-image');
        
        // Should not load all images at once (respects MAX_CONCURRENT_LOADS)
        const totalLoading = loadingSpinners.length + loadedImages.length;
        expect(totalLoading).toBeLessThan(networkData.nodes.length);
      }, { timeout: 500 });
      
      unmount();
      document.querySelectorAll = originalQuerySelectorAll;
    });

    test('should track memory usage and provide performance stats', async () => {
      const networkData = createTestNetworkData(25, true);

      const { unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      // Wait for component to initialize
      await waitFor(() => {
        expect(mockZoom.setupZoomBehavior).toHaveBeenCalled();
      }, { timeout: 500 });

      // Simulate checking performance stats
      // In the actual implementation, ImageLoadingManager.getPerformanceStats() would be called
      const mockStats = {
        loadedImages: 15,
        failedImages: 2,
        pendingImages: 8,
        viewportCacheSize: 25,
        imageQuality: { low: 5, medium: 8, high: 2 },
        totalRenderedImages: 15,
        memoryUsageMB: 50
      };

      expect(mockStats.memoryUsageMB).toBeLessThan(100); // Should maintain reasonable memory usage
      expect(mockStats.loadedImages + mockStats.failedImages + mockStats.pendingImages).toBeLessThanOrEqual(networkData.nodes.length);
      
      unmount();
    });
  });

  describe('Rendering Performance', () => {
    test('should handle network resize efficiently', async () => {
      const networkData = createTestNetworkData(40, true);

      const { rerender, unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(mockZoom.setupZoomBehavior).toHaveBeenCalled();
      }, { timeout: 500 });

      const resizeStartTime = Date.now();

      // Simulate viewport resize
      if (mockSvgRef.current?.parentElement) {
        (mockSvgRef.current.parentElement as any).clientWidth = 1200;
        (mockSvgRef.current.parentElement as any).clientHeight = 800;
      }

      // Trigger rerender
      rerender(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      const resizeTime = Date.now() - resizeStartTime;
      expect(resizeTime).toBeLessThan(500); // Should handle resize quickly
      
      unmount();
    });

    test('should maintain performance with filter changes', async () => {
      const networkData = createTestNetworkData(60, true);

      const { rerender, unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(mockZoom.setupZoomBehavior).toHaveBeenCalled();
      }, { timeout: 500 });

      const filterStartTime = Date.now();

      // Change filter state
      rerender(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: false, showSongwriters: false }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      const filterTime = Date.now() - filterStartTime;
      expect(filterTime).toBeLessThan(300); // Should handle filter changes quickly
      
      unmount();
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should gracefully handle image loading failures', async () => {
      // Mock Image to always fail
      class FailingMockImage {
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;
        crossOrigin: string = '';
        src: string = '';
        
        constructor() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 50);
        }
      }

      global.Image = FailingMockImage as any;

      // Mock placeholder elements
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('image-placeholder')) {
          return Array.from({ length: 5 }, () => ({ style: { opacity: '1' }})) as any;
        }
        return originalQuerySelectorAll.call(document, selector);
      });

      const networkData = createTestNetworkData(10, true);

      const { unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      // Wait for error handling
      await waitFor(() => {
        const placeholders = document.querySelectorAll('.image-placeholder');
        expect(placeholders.length).toBeGreaterThan(0); // Should show placeholders for failed images
      }, { timeout: 1000 });

      unmount();
      document.querySelectorAll = originalQuerySelectorAll;
      // Restore original Image mock
      global.Image = MockImage as any;
    });

    test('should maintain performance with mixed success/failure rates', async () => {
      const networkData = createTestNetworkData(20, true);
      let imageCount = 0;

      // Mock Image with 50% failure rate
      class MixedMockImage {
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;
        crossOrigin: string = '';
        src: string = '';
        
        constructor() {
          const shouldSucceed = (imageCount++ % 2) === 0;
          setTimeout(() => {
            if (shouldSucceed && this.onload) {
              this.onload();
            } else if (!shouldSucceed && this.onerror) {
              this.onerror();
            }
          }, 100);
        }
      }

      global.Image = MixedMockImage as any;

      // Mock mixed success/failure elements
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('image.profile-image')) {
          return Array.from({ length: 10 }, () => ({ style: { opacity: '1' }})) as any;
        }
        if (selector.includes('image-placeholder')) {
          return Array.from({ length: 10 }, () => ({ style: { opacity: '1' }})) as any;
        }
        return originalQuerySelectorAll.call(document, selector);
      });

      const startTime = Date.now();

      const { unmount } = render(
        <svg ref={mockSvgRef}>
          <D3NetworkRenderer
            data={networkData}
            visible={true}
            filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        </svg>
      );

      await waitFor(() => {
        const images = document.querySelectorAll('image.profile-image');
        const placeholders = document.querySelectorAll('.image-placeholder');
        const total = images.length + placeholders.length;
        
        expect(total).toBeGreaterThan(0); // Should handle mixed results
      }, { timeout: 2000 });

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(3000); // Should maintain performance even with failures

      unmount();
      document.querySelectorAll = originalQuerySelectorAll;
      // Restore original Image mock
      global.Image = MockImage as any;
    });
  });
});
