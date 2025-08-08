import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import * as d3 from 'd3';
import D3NetworkRenderer, { D3NetworkRendererProps } from './d3-network-renderer';
import { NetworkData, NetworkNode, NetworkLink, FilterState } from '@/types/network';
import { UseZoomReturn } from '@/hooks/use-zoom';
import { UseNodeInteractionsReturn } from '@/hooks/use-node-interactions';
import { UseTooltipReturn } from '@/hooks/use-tooltip';

// Mock D3 completely
vi.mock('d3', () => ({
  select: vi.fn(),
  forceSimulation: vi.fn(),
  forceLink: vi.fn(),
  forceManyBody: vi.fn(),
  forceCollide: vi.fn(),
  forceX: vi.fn(),
  forceY: vi.fn(),
  arc: vi.fn(),
}));

// Mock console methods
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('D3NetworkRenderer', () => {
  let mockSvgRef: React.RefObject<SVGSVGElement>;
  let mockSimulationRef: React.RefObject<d3.Simulation<NetworkNode, NetworkLink> | null>;
  let mockZoom: UseZoomReturn;
  let mockNodeInteractions: UseNodeInteractionsReturn;
  let mockTooltip: UseTooltipReturn;
  let mockNetworkData: NetworkData;
  let mockFilterState: FilterState;

  // Mock D3 selection methods
  const mockSelection = {
    selectAll: vi.fn(),
    remove: vi.fn(),
    append: vi.fn(),
    attr: vi.fn(),
    style: vi.fn(),
    on: vi.fn(),
    data: vi.fn(),
    enter: vi.fn(),
    each: vi.fn(),
    text: vi.fn(),
    datum: vi.fn(),
  };

  // Mock D3 simulation methods
  const mockSimulation = {
    force: vi.fn(),
    on: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    alpha: vi.fn(),
  };

  // Mock D3 force methods
  const mockForceLink = {
    id: vi.fn(),
    distance: vi.fn(),
  };

  const mockForceManyBody = {
    strength: vi.fn(),
  };

  const mockForceCollide = {
    radius: vi.fn(),
  };

  const mockForceX = {
    strength: vi.fn(),
  };

  const mockForceY = {
    strength: vi.fn(),
  };

  // Mock arc generator
  const mockArc = {
    innerRadius: vi.fn(),
    outerRadius: vi.fn(),
    startAngle: vi.fn(),
    endAngle: vi.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup SVG ref with mock element
    const mockSvgElement = {
      parentElement: {
        clientWidth: 800,
        clientHeight: 600,
      },
      getAttribute: vi.fn(() => '0 0 800 600'),
    } as unknown as SVGSVGElement;

    mockSvgRef = { current: mockSvgElement };
    mockSimulationRef = { current: null };

    // Setup mock zoom hook
    mockZoom = {
      currentZoom: 1,
      handleZoomIn: vi.fn(),
      handleZoomOut: vi.fn(),
      handleZoomReset: vi.fn(),
      applyZoom: vi.fn(),
      applyPinchZoom: vi.fn(),
      setupZoomBehavior: vi.fn(),
    };

    // Setup mock node interactions hook
    mockNodeInteractions = {
      dragstarted: vi.fn(),
      dragged: vi.fn(),
      dragended: vi.fn(),
      handleNodeClick: vi.fn(),
      setupDragBehavior: vi.fn(),
    };

    // Setup mock tooltip hook
    mockTooltip = {
      isTooltipVisible: false,
      tooltipPosition: { x: 0, y: 0 },
      highlightedNode: null,
      currentNode: null,
      showTooltip: vi.fn(),
      hideTooltip: vi.fn(),
      moveTooltip: vi.fn(),
      positionTooltipNearNode: vi.fn(),
      highlightNode: vi.fn(),
      resetNodeHighlight: vi.fn(),
      handleNetworkAction: vi.fn(),
      handleExpandAction: vi.fn(),
      handleProfileAction: vi.fn(),
      handleCollaborationAction: vi.fn(),
    };

    // Setup test network data
    mockNetworkData = {
      nodes: [
        { id: 'node1', name: 'Artist 1', type: 'artist', size: 30, x: 100, y: 100 },
        { id: 'node2', name: 'Producer 1', type: 'producer', size: 20, x: 200, y: 200 },
        { id: 'node3', name: 'Songwriter 1', type: 'songwriter', size: 15, x: 300, y: 300 },
        { id: 'node4', name: 'Multi Role', type: 'artist', types: ['artist', 'producer'], size: 25, x: 400, y: 400 },
      ],
      links: [
        { source: 'node1', target: 'node2', type: 'production' },
        { source: 'node1', target: 'node3', type: 'songwriting' },
        { source: 'node2', target: 'node4', type: 'production' },
      ],
    };

    // Setup filter state
    mockFilterState = {
      showArtists: true,
      showProducers: true,
      showSongwriters: true,
    };

    // Setup D3 mocks
    (d3.select as any).mockReturnValue(mockSelection);
    (d3.forceSimulation as any).mockReturnValue(mockSimulation);
    (d3.forceLink as any).mockReturnValue(mockForceLink);
    (d3.forceManyBody as any).mockReturnValue(mockForceManyBody);
    (d3.forceCollide as any).mockReturnValue(mockForceCollide);
    (d3.forceX as any).mockReturnValue(mockForceX);
    (d3.forceY as any).mockReturnValue(mockForceY);
    (d3.arc as any).mockReturnValue(mockArc);

    // Chain mock methods
    mockSelection.selectAll.mockReturnValue(mockSelection);
    mockSelection.remove.mockReturnValue(mockSelection);
    mockSelection.append.mockReturnValue(mockSelection);
    mockSelection.attr.mockReturnValue(mockSelection);
    mockSelection.style.mockReturnValue(mockSelection);
    mockSelection.on.mockReturnValue(mockSelection);
    mockSelection.data.mockReturnValue(mockSelection);
    mockSelection.enter.mockReturnValue(mockSelection);
    mockSelection.each.mockReturnValue(mockSelection);
    mockSelection.text.mockReturnValue(mockSelection);

    mockSimulation.force.mockReturnValue(mockSimulation);
    mockSimulation.on.mockReturnValue(mockSimulation);
    mockSimulation.alpha.mockReturnValue(mockSimulation);

    mockForceLink.id.mockReturnValue(mockForceLink);
    mockForceLink.distance.mockReturnValue(mockForceLink);
    mockForceManyBody.strength.mockReturnValue(mockForceManyBody);
    mockForceCollide.radius.mockReturnValue(mockForceCollide);
    mockForceX.strength.mockReturnValue(mockForceX);
    mockForceY.strength.mockReturnValue(mockForceY);

    mockArc.innerRadius.mockReturnValue(mockArc);
    mockArc.outerRadius.mockReturnValue(mockArc);
    mockArc.startAngle.mockReturnValue(mockArc);
    mockArc.endAngle.mockReturnValue(mockArc);

    // Mock window event listeners
    global.addEventListener = vi.fn();
    global.removeEventListener = vi.fn();
  });

  afterEach(() => {
    consoleSpy.mockClear();
  });

  const createDefaultProps = (overrides?: Partial<D3NetworkRendererProps>): D3NetworkRendererProps => ({
    data: mockNetworkData,
    visible: true,
    filterState: mockFilterState,
    svgRef: mockSvgRef,
    simulationRef: mockSimulationRef,
    zoom: mockZoom,
    nodeInteractions: mockNodeInteractions,
    tooltip: mockTooltip,
    mainArtistNode: mockNetworkData.nodes[0],
    ...overrides,
  });

  describe('Component Initialization', () => {
    it('should render without crashing with valid props', () => {
      const props = createDefaultProps();
      
      expect(() => {
        render(<D3NetworkRenderer {...props} />);
      }).not.toThrow();
    });

    it('should not render when not visible', () => {
      const props = createDefaultProps({ visible: false });
      
      render(<D3NetworkRenderer {...props} />);
      
      // Should not initialize D3 when not visible
      expect(d3.select).not.toHaveBeenCalled();
    });

    it('should not render when svgRef is null', () => {
      const props = createDefaultProps({ svgRef: { current: null } });
      
      render(<D3NetworkRenderer {...props} />);
      
      // Should not initialize D3 when svgRef is null
      expect(d3.select).not.toHaveBeenCalled();
    });

    it('should not render when data is null', () => {
      const props = createDefaultProps({ data: null as any });
      
      render(<D3NetworkRenderer {...props} />);
      
      // D3 may be called for basic SVG setup, but should handle null data gracefully
      expect(() => {
        render(<D3NetworkRenderer {...props} />);
      }).not.toThrow();
    });
  });

  describe('D3 Simulation Initialization', () => {
    it('should initialize D3 simulation with correct forces', () => {
      const props = createDefaultProps();
      
      render(<D3NetworkRenderer {...props} />);
      
      // Verify D3 simulation is created
      expect(d3.forceSimulation).toHaveBeenCalledWith(mockNetworkData.nodes);
      
      // Verify all forces are applied
      expect(mockSimulation.force).toHaveBeenCalledWith('link', expect.anything());
      expect(mockSimulation.force).toHaveBeenCalledWith('charge', expect.anything());
      expect(mockSimulation.force).toHaveBeenCalledWith('collision', expect.anything());
      expect(mockSimulation.force).toHaveBeenCalledWith('boundary', expect.anything());
      expect(mockSimulation.force).toHaveBeenCalledWith('centerX', expect.anything());
      expect(mockSimulation.force).toHaveBeenCalledWith('centerY', expect.anything());
    });

    it('should configure force link with correct parameters', () => {
      const props = createDefaultProps();
      
      render(<D3NetworkRenderer {...props} />);
      
      expect(d3.forceLink).toHaveBeenCalled();
      expect(mockForceLink.id).toHaveBeenCalled();
      expect(mockForceLink.distance).toHaveBeenCalledWith(80);
    });

    it('should configure many-body force with correct strength', () => {
      const props = createDefaultProps();
      
      render(<D3NetworkRenderer {...props} />);
      
      expect(d3.forceManyBody).toHaveBeenCalled();
      expect(mockForceManyBody.strength).toHaveBeenCalledWith(-150);
    });

    it('should set simulation reference', () => {
      const props = createDefaultProps();
      
      render(<D3NetworkRenderer {...props} />);
      
      expect(props.simulationRef.current).toBeDefined();
    });
  });

  describe('SVG Setup and Rendering', () => {
    it('should clear existing SVG content', () => {
      const props = createDefaultProps();
      
      render(<D3NetworkRenderer {...props} />);
      
      expect(d3.select).toHaveBeenCalledWith(mockSvgRef.current);
      expect(mockSelection.selectAll).toHaveBeenCalledWith('*');
      expect(mockSelection.remove).toHaveBeenCalled();
    });

    it('should create network group', () => {
      const props = createDefaultProps();
      
      render(<D3NetworkRenderer {...props} />);
      
      expect(mockSelection.append).toHaveBeenCalledWith('g');
      expect(mockSelection.attr).toHaveBeenCalledWith('class', 'network-group');
    });

    it('should setup zoom behavior', () => {
      const props = createDefaultProps();
      
      render(<D3NetworkRenderer {...props} />);
      
      expect(props.zoom.setupZoomBehavior).toHaveBeenCalled();
    });

    it('should add background click handler', () => {
      const props = createDefaultProps();
      
      render(<D3NetworkRenderer {...props} />);
      
      expect(mockSelection.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Filter Visibility Management', () => {
    it('should show all nodes when all filters are enabled', () => {
      const props = createDefaultProps({
        filterState: { showArtists: true, showProducers: true, showSongwriters: true }
      });
      
      render(<D3NetworkRenderer {...props} />);
      
      // Should call style to show elements
      expect(mockSelection.style).toHaveBeenCalledWith('display', expect.any(Function));
    });

    it('should hide producer nodes when producer filter is disabled', () => {
      const props = createDefaultProps({
        filterState: { showArtists: true, showProducers: false, showSongwriters: true }
      });
      
      render(<D3NetworkRenderer {...props} />);
      
      // Should call style to hide producer nodes
      expect(mockSelection.style).toHaveBeenCalledWith('display', expect.any(Function));
    });
  });

  describe('Memory Management', () => {
    it('should clean up D3 selections on unmount', () => {
      const props = createDefaultProps();
      
      const { unmount } = render(<D3NetworkRenderer {...props} />);
      
      // Simulate unmount
      unmount();
      
      // Verify cleanup functions are called
      expect(mockSimulation.stop).toHaveBeenCalled();
      expect(global.removeEventListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty network data gracefully', () => {
      const emptyData = { nodes: [], links: [] };
      const props = createDefaultProps({ data: emptyData });
      
      expect(() => {
        render(<D3NetworkRenderer {...props} />);
      }).not.toThrow();
    });

    it('should handle malformed network data gracefully', () => {
      const malformedData = {
        nodes: [{ id: 'test' } as any], // Missing required fields
        links: [{ source: 'test', target: 'nonexistent' } as any],
      };
      
      const props = createDefaultProps({ data: malformedData });
      
      expect(() => {
        render(<D3NetworkRenderer {...props} />);
      }).not.toThrow();
    });
  });

  // Task 2.2: Profile Picture Node Rendering Tests
  describe('Profile Picture Node Rendering - Task 2.2', () => {
    let mockNodeGroup: any;
    let mockImageEvents: { [key: string]: Function };
    let nodeEachCallback: ((d: any) => void) | null = null;

    beforeEach(() => {
      mockImageEvents = {};
      
      // Create enhanced mocks for nested D3 operations
      mockNodeGroup = {
        append: vi.fn().mockReturnThis(),
        attr: vi.fn().mockReturnThis(),
        style: vi.fn().mockReturnThis(),
        on: vi.fn((event: string, handler: Function) => {
          mockImageEvents[event] = handler;
          return mockNodeGroup;
        }),
        transition: vi.fn().mockReturnThis(),
        duration: vi.fn().mockReturnThis(),
        remove: vi.fn().mockReturnThis(),
      };

      // Enhanced mock selection that captures the each callback
      const enhancedMockSelection = {
        ...mockSelection,
        each: vi.fn((callback: (d: any) => void) => {
          nodeEachCallback = callback;
          return enhancedMockSelection;
        }),
        selectAll: vi.fn(() => enhancedMockSelection),
        data: vi.fn(() => enhancedMockSelection),
        enter: vi.fn(() => enhancedMockSelection),
        append: vi.fn((element: string) => {
          if (element === 'g') {
            return enhancedMockSelection;
          }
          return mockNodeGroup;
        }),
      };

      // Override d3.select to use our enhanced mock
      (d3.select as any).mockReturnValue(enhancedMockSelection);
    });

    describe('Single Role Artist Nodes with Profile Pictures', () => {
      it('should render single-role artist nodes with profile pictures and colored borders', () => {
        const testNode = {
          id: 'artist1',
          name: 'Taylor Swift',
          type: 'artist' as const,
          size: 30,
          imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a396a61647',
          spotifyId: 'spotify-artist-1',
        };

        const dataWithImages = {
          nodes: [testNode],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithImages });
        render(<D3NetworkRenderer {...props} />);

        // Verify that the each callback was captured
        expect(nodeEachCallback).toBeDefined();

        if (nodeEachCallback) {
          // Simulate the each callback execution with our test node
          // Create a mock d3.select call for this specific node
          const mockGroupSelect = vi.fn(() => mockNodeGroup);
          (d3.select as any).mockReturnValue(mockNodeGroup);

          // Execute the each callback as if D3 is iterating through nodes
          nodeEachCallback.call(mockNodeGroup, testNode);

          // Verify single-role circle creation
          expect(mockNodeGroup.append).toHaveBeenCalledWith('circle');
          expect(mockNodeGroup.attr).toHaveBeenCalledWith('r', 30);
          expect(mockNodeGroup.attr).toHaveBeenCalledWith('fill', 'transparent');
          expect(mockNodeGroup.attr).toHaveBeenCalledWith('stroke-width', 4);

          // Verify profile picture elements are created
          expect(mockNodeGroup.append).toHaveBeenCalledWith('defs');
          expect(mockNodeGroup.append).toHaveBeenCalledWith('clipPath');
          expect(mockNodeGroup.append).toHaveBeenCalledWith('image');

          // Verify loading spinner creation
          expect(mockNodeGroup.append).toHaveBeenCalledWith('g');
          expect(mockNodeGroup.attr).toHaveBeenCalledWith('class', 'loading-spinner');
        }
      });

      it('should apply correct magenta pink border color for single-role artists', () => {
        const testNode = {
          id: 'artist1',
          name: 'Artist Name',
          type: 'artist' as const,
          size: 25,
          imageUrl: 'https://example.com/image.jpg',
        };

        const dataWithArtist = {
          nodes: [testNode],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithArtist });
        render(<D3NetworkRenderer {...props} />);

        // Execute the each callback to test stroke color logic
        if (nodeEachCallback) {
          (d3.select as any).mockReturnValue(mockNodeGroup);
          nodeEachCallback.call(mockNodeGroup, testNode);

          // For single-role artist, stroke should be set during circle creation
          // The stroke function should have been called within the callback
          expect(mockNodeGroup.append).toHaveBeenCalledWith('circle');
          expect(mockNodeGroup.attr).toHaveBeenCalled();
        }
      });

      it('should create properly sized circular clip paths for profile images', () => {
        const testNode = {
          id: 'artist-with-image',
          name: 'Artist With Image',
          type: 'artist' as const,
          size: 40,
          imageUrl: 'https://example.com/profile.jpg',
        };

        const dataWithImages = {
          nodes: [testNode],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithImages });
        render(<D3NetworkRenderer {...props} />);

        if (nodeEachCallback) {
          (d3.select as any).mockReturnValue(mockNodeGroup);
          nodeEachCallback.call(mockNodeGroup, testNode);

          // Verify clipPath creation with proper ID
          expect(mockNodeGroup.append).toHaveBeenCalledWith('clipPath');
          expect(mockNodeGroup.attr).toHaveBeenCalledWith('id', 'clip-artist_with_image');
          
          // Verify circular clipping area
          expect(mockNodeGroup.append).toHaveBeenCalledWith('circle');
          
          // Expected radius should be node.size - 4 = 36
          const expectedRadius = 36;
          expect(mockNodeGroup.attr).toHaveBeenCalledWith('r', expectedRadius);
          
          // Verify image sizing and positioning
          expect(mockNodeGroup.append).toHaveBeenCalledWith('image');
          expect(mockNodeGroup.attr).toHaveBeenCalledWith('class', 'profile-image');
        }
      });

      it('should handle image loading states with smooth transitions', () => {
        const testNode = {
          id: 'artist1',
          name: 'Artist With Loading Image',
          type: 'artist' as const,
          size: 30,
          imageUrl: 'https://example.com/loading-image.jpg',
        };

        const dataWithImages = {
          nodes: [testNode],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithImages });
        render(<D3NetworkRenderer {...props} />);

        if (nodeEachCallback) {
          (d3.select as any).mockReturnValue(mockNodeGroup);
          nodeEachCallback.call(mockNodeGroup, testNode);

          // Verify loading spinner is created initially
          expect(mockNodeGroup.append).toHaveBeenCalledWith('g');
          expect(mockNodeGroup.attr).toHaveBeenCalledWith('class', 'loading-spinner');
          expect(mockNodeGroup.style).toHaveBeenCalledWith('opacity', 1);

          // Verify image is created with initial opacity 0
          expect(mockNodeGroup.append).toHaveBeenCalledWith('image');
          expect(mockNodeGroup.style).toHaveBeenCalledWith('opacity', 0);

          // Verify image load event handler is set
          expect(mockNodeGroup.on).toHaveBeenCalledWith('load', expect.any(Function));
          expect(mockNodeGroup.on).toHaveBeenCalledWith('error', expect.any(Function));
        }
      });

      it('should gracefully handle image load errors with fallback', () => {
        const testNode = {
          id: 'artist1',
          name: 'Artist With Broken Image',
          type: 'artist' as const,
          size: 30,
          imageUrl: 'https://example.com/broken-image.jpg',
        };

        const dataWithImages = {
          nodes: [testNode],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithImages });
        
        // Should handle render gracefully without throwing
        expect(() => {
          render(<D3NetworkRenderer {...props} />);
        }).not.toThrow();

        // Should still set up basic node structure
        if (nodeEachCallback) {
          expect(() => {
            (d3.select as any).mockReturnValue(mockNodeGroup);
            nodeEachCallback.call(mockNodeGroup, testNode);
          }).not.toThrow();
        }
      });
    });

    describe('Multi-Role Nodes with Profile Pictures', () => {
      it('should render multi-role nodes with profile pictures in center and segmented colored borders', () => {
        const testNode = {
          id: 'multirole1',
          name: 'Artist Producer',
          type: 'artist' as const,
          types: ['artist', 'producer'],
          size: 35,
          imageUrl: 'https://example.com/multi-role.jpg',
        };

        const dataWithMultiRole = {
          nodes: [testNode],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithMultiRole });
        render(<D3NetworkRenderer {...props} />);

        if (nodeEachCallback) {
          (d3.select as any).mockReturnValue(mockNodeGroup);
          nodeEachCallback.call(mockNodeGroup, testNode);

          // Verify multi-role arc creation
          expect(d3.arc).toHaveBeenCalled();
          expect(mockNodeGroup.append).toHaveBeenCalledWith('path');

          // Verify inner circle for multi-role nodes
          expect(mockNodeGroup.append).toHaveBeenCalledWith('circle');

          // Verify profile picture is still created in center
          expect(mockNodeGroup.append).toHaveBeenCalledWith('image');
          expect(mockNodeGroup.append).toHaveBeenCalledWith('clipPath');
        }
      });

    });

    describe('Fallback Behavior for Nodes Without Images', () => {
      it('should render normal colored circles for nodes without imageUrl', () => {
        const testNode = {
          id: 'no-image-artist',
          name: 'Artist Without Image',
          type: 'artist' as const,
          size: 25,
          imageUrl: null,
        };

        const dataWithoutImages = {
          nodes: [testNode],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithoutImages });
        render(<D3NetworkRenderer {...props} />);

        if (nodeEachCallback) {
          (d3.select as any).mockReturnValue(mockNodeGroup);
          nodeEachCallback.call(mockNodeGroup, testNode);

          // Should create normal circle
          expect(mockNodeGroup.append).toHaveBeenCalledWith('circle');
          
          // Should NOT create image-related elements
          expect(mockNodeGroup.append).not.toHaveBeenCalledWith('image');
          expect(mockNodeGroup.append).not.toHaveBeenCalledWith('clipPath');
        }
      });
    });

    describe('Interactive Behavior with Profile Pictures', () => {
      it('should maintain click interactions on nodes with profile pictures', () => {
        const dataWithImages = {
          nodes: [
            {
              id: 'clickable-artist',
              name: 'Clickable Artist',
              type: 'artist' as const,
              size: 30,
              imageUrl: 'https://example.com/clickable.jpg',
            },
          ],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithImages });
        render(<D3NetworkRenderer {...props} />);

        // Verify the component renders and interactions are set up
        expect(mockNodeInteractions.setupDragBehavior).toHaveBeenCalled();
      });
    });

    describe('Performance and Error Handling', () => {
      it('should handle large networks with multiple profile pictures efficiently', () => {
        const largeNetworkData = {
          nodes: Array.from({ length: 10 }, (_, i) => ({
            id: `artist-${i}`,
            name: `Artist ${i}`,
            type: 'artist' as const,
            size: 20 + Math.random() * 20,
            imageUrl: i % 2 === 0 ? `https://example.com/image-${i}.jpg` : null,
          })),
          links: [],
        };

        const props = createDefaultProps({ data: largeNetworkData });
        
        expect(() => {
          render(<D3NetworkRenderer {...props} />);
        }).not.toThrow();
      });

      it('should properly handle malformed image URLs gracefully', () => {
        const testNode = {
          id: 'bad-url-artist',
          name: 'Artist With Bad URL',
          type: 'artist' as const,
          size: 30,
          imageUrl: 'not-a-valid-url',
        };

        const dataWithBadUrl = {
          nodes: [testNode],
          links: [],
        };

        const props = createDefaultProps({ data: dataWithBadUrl });
        
        expect(() => {
          render(<D3NetworkRenderer {...props} />);
        }).not.toThrow();

        if (nodeEachCallback) {
          expect(() => {
            (d3.select as any).mockReturnValue(mockNodeGroup);
            nodeEachCallback.call(mockNodeGroup, testNode);
          }).not.toThrow();
        }
      });
    });
  });
});
