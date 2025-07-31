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
      
      // Should not initialize D3 when data is null
      expect(d3.select).not.toHaveBeenCalled();
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
});
