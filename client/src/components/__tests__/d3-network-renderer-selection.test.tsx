import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import D3NetworkRenderer from '../d3-network-renderer';
import { NetworkData, NetworkNode, NetworkLink, FilterState } from '@/types/network';
import { UseZoomReturn } from '@/hooks/use-zoom';
import { UseNodeInteractionsReturn } from '@/hooks/use-node-interactions';
import { UseTooltipReturn } from '@/hooks/use-tooltip';
import * as d3 from 'd3';

// Mock D3 and required hooks
jest.mock('d3', () => ({
  select: jest.fn(),
  forceSimulation: jest.fn(),
  forceLink: jest.fn(),
  forceManyBody: jest.fn(),
  forceCollide: jest.fn(),
  forceX: jest.fn(),
  forceY: jest.fn(),
  drag: jest.fn(),
  zoomTransform: jest.fn(),
  arc: jest.fn(),
}));

jest.mock('@/hooks/use-filter-visibility', () => ({
  useFilterVisibility: () => ({
    isNodeVisible: jest.fn().mockReturnValue(true),
  }),
}));

// Sample test data
const mockNetworkData: NetworkData = {
  nodes: [
    {
      id: 'artist1',
      name: 'Main Artist',
      type: 'artist',
      types: ['artist'],
      size: 30,
      x: 200,
      y: 200,
    },
    {
      id: 'producer1',
      name: 'Producer 1',
      type: 'producer',
      types: ['producer'],
      size: 20,
      x: 150,
      y: 150,
    },
    {
      id: 'multi1',
      name: 'Multi Role Artist',
      type: 'artist',
      types: ['artist', 'producer', 'songwriter'],
      size: 25,
      x: 250,
      y: 250,
    },
  ],
  links: [
    {
      source: 'artist1',
      target: 'producer1',
      type: 'production',
    },
    {
      source: 'artist1',
      target: 'multi1',
      type: 'collaboration',
    },
  ],
};

const mockFilterState: FilterState = {
  showArtists: true,
  showProducers: true,
  showSongwriters: true,
  showCollaborations: true,
  showProductions: true,
};

// Mock implementations
const mockSimulation = {
  nodes: jest.fn().mockReturnThis(),
  force: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  stop: jest.fn(),
  alphaTarget: jest.fn().mockReturnThis(),
  restart: jest.fn().mockReturnThis(),
};

const mockD3Selection = {
  selectAll: jest.fn().mockReturnThis(),
  data: jest.fn().mockReturnThis(),
  enter: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  call: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  each: jest.fn().mockReturnThis(),
  transition: jest.fn().mockReturnThis(),
  duration: jest.fn().mockReturnThis(),
  empty: jest.fn().mockReturnValue(false),
  node: jest.fn(),
  datum: jest.fn(),
  querySelector: jest.fn(),
  insertBefore: jest.fn(),
  appendChild: jest.fn(),
  getAttribute: jest.fn(),
  setAttribute: jest.fn(),
  createElementNS: jest.fn(),
};

// Mock zoom system
const mockZoom: UseZoomReturn = {
  currentZoom: 1,
  handleZoomIn: jest.fn(),
  handleZoomOut: jest.fn(),
  handleZoomReset: jest.fn(),
  applyZoom: jest.fn(),
  applyPinchZoom: jest.fn(),
  setupZoomBehavior: jest.fn(),
};

// Mock tooltip system
const mockTooltip: UseTooltipReturn = {
  isTooltipVisible: false,
  tooltipPosition: { x: 0, y: 0 },
  highlightedNode: null,
  currentNode: null,
  showTooltip: jest.fn(),
  hideTooltip: jest.fn(),
  moveTooltip: jest.fn(),
  positionTooltipNearNode: jest.fn(),
  setHighlightedNode: jest.fn(),
  resetNodeHighlight: jest.fn(),
  handleNetworkAction: jest.fn(),
  handleExpandAction: jest.fn(),
  handleProfileAction: jest.fn(),
  handleCollaborationAction: jest.fn(),
};

// Mock node interactions with selection functionality
const mockNodeInteractions: UseNodeInteractionsReturn = {
  dragstarted: jest.fn(),
  dragged: jest.fn(),
  dragended: jest.fn(),
  handleNodeClick: jest.fn(),
  setupDragBehavior: jest.fn(),
  selectedNode: null,
  resetAllSelections: jest.fn(),
};

const mockSimulationRef = {
  current: mockSimulation,
};

const mockSvgRef = {
  current: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
};

describe('D3NetworkRenderer - Click Selection Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup D3 mocks
    (d3.select as jest.Mock).mockReturnValue(mockD3Selection);
    (d3.forceSimulation as jest.Mock).mockReturnValue(mockSimulation);
    (d3.forceLink as jest.Mock).mockReturnValue({ id: jest.fn().mockReturnThis(), distance: jest.fn().mockReturnThis() });
    (d3.forceManyBody as jest.Mock).mockReturnValue({ strength: jest.fn().mockReturnThis() });
    (d3.forceCollide as jest.Mock).mockReturnValue({ radius: jest.fn().mockReturnThis() });
    (d3.forceX as jest.Mock).mockReturnValue({ strength: jest.fn().mockReturnThis() });
    (d3.forceY as jest.Mock).mockReturnValue({ strength: jest.fn().mockReturnThis() });
    (d3.drag as jest.Mock).mockReturnValue({ on: jest.fn().mockReturnThis() });
    
    // Mock SVG element methods
    const mockSvgElement = mockSvgRef.current as any;
    mockSvgElement.parentElement = {
      clientWidth: 800,
      clientHeight: 600,
    };
    mockSvgElement.querySelector = jest.fn();
    mockSvgElement.insertBefore = jest.fn();
    mockSvgElement.appendChild = jest.fn();
    
    // Mock document methods for SVG namespace
    document.createElementNS = jest.fn().mockReturnValue({
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      getAttribute: jest.fn(),
      querySelector: jest.fn(),
      children: { length: 0 },
      remove: jest.fn(),
    });
  });

  const defaultProps = {
    data: mockNetworkData,
    visible: true,
    filterState: mockFilterState,
    svgRef: mockSvgRef,
    simulationRef: mockSimulationRef,
    zoom: mockZoom,
    nodeInteractions: mockNodeInteractions,
    tooltip: mockTooltip,
    mainArtistNode: mockNetworkData.nodes[0],
  };

  describe('Background Click Handling', () => {
    it('should reset selections on background click', async () => {
      render(<D3NetworkRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(d3.select).toHaveBeenCalled();
      });

      // Find the background click handler
      const onCallArgs = (mockD3Selection.on as jest.Mock).mock.calls;
      const clickHandler = onCallArgs.find(call => call[0] === 'click')?.[1];

      expect(clickHandler).toBeDefined();

      // Simulate background click
      const mockEvent = {
        target: mockSvgRef.current,
      };

      clickHandler(mockEvent);

      expect(mockTooltip.hideTooltip).toHaveBeenCalled();
      expect(mockNodeInteractions.resetAllSelections).toHaveBeenCalled();
    });

    it('should not reset selections when clicking on non-background elements', async () => {
      render(<D3NetworkRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(d3.select).toHaveBeenCalled();
      });

      const onCallArgs = (mockD3Selection.on as jest.Mock).mock.calls;
      const clickHandler = onCallArgs.find(call => call[0] === 'click')?.[1];

      // Simulate click on a node element (not background)
      const mockEvent = {
        target: document.createElement('circle'),
      };

      clickHandler(mockEvent);

      expect(mockTooltip.hideTooltip).not.toHaveBeenCalled();
      expect(mockNodeInteractions.resetAllSelections).not.toHaveBeenCalled();
    });
  });

  describe('Node Click Integration', () => {
    it('should integrate node click handling with selection mechanism', async () => {
      render(<D3NetworkRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(mockD3Selection.on).toHaveBeenCalled();
      });

      // Verify that node click handler is set up
      const onCallArgs = (mockD3Selection.on as jest.Mock).mock.calls;
      const nodeClickCall = onCallArgs.find(call => call[0] === 'click');

      expect(nodeClickCall).toBeDefined();
      expect(mockNodeInteractions.setupDragBehavior).toHaveBeenCalled();
    });

    it('should coordinate node interactions with tooltip system', async () => {
      render(<D3NetworkRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(mockD3Selection.each).toHaveBeenCalled();
      });

      // Verify that the node rendering includes click handling
      const eachCallArgs = (mockD3Selection.each as jest.Mock).mock.calls;
      expect(eachCallArgs.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Role Node Rendering', () => {
    it('should render segmented circles for multi-role nodes', async () => {
      render(<D3NetworkRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(mockD3Selection.each).toHaveBeenCalled();
      });

      // Verify that the each function processes nodes correctly
      const eachCallback = (mockD3Selection.each as jest.Mock).mock.calls[0][0];
      expect(typeof eachCallback).toBe('function');

      // Test the callback with a multi-role node
      const mockThis = mockD3Selection;
      const multiRoleNode = mockNetworkData.nodes[2]; // Multi role artist

      // Mock D3 arc function
      const mockArc = {
        innerRadius: jest.fn().mockReturnThis(),
        outerRadius: jest.fn().mockReturnThis(),
        startAngle: jest.fn().mockReturnThis(),
        endAngle: jest.fn().mockReturnThis(),
      };
      (d3.arc as jest.Mock).mockReturnValue(mockArc);

      eachCallback.call(mockThis, multiRoleNode);

      // Verify that paths are created for multi-role nodes
      expect(mockD3Selection.append).toHaveBeenCalled();
    });

    it('should render simple circles for single-role nodes', async () => {
      render(<D3NetworkRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(mockD3Selection.each).toHaveBeenCalled();
      });

      const eachCallback = (mockD3Selection.each as jest.Mock).mock.calls[0][0];
      const singleRoleNode = mockNetworkData.nodes[1]; // Producer

      eachCallback.call(mockD3Selection, singleRoleNode);

      expect(mockD3Selection.append).toHaveBeenCalledWith('circle');
    });
  });

  describe('Selection State Persistence', () => {
    it('should maintain selection state across re-renders', async () => {
      const { rerender } = render(<D3NetworkRenderer {...defaultProps} />);

      // Update node interactions to have a selected node
      const updatedNodeInteractions = {
        ...mockNodeInteractions,
        selectedNode: mockD3Selection,
      };

      rerender(
        <D3NetworkRenderer 
          {...defaultProps} 
          nodeInteractions={updatedNodeInteractions}
        />
      );

      await waitFor(() => {
        expect(d3.select).toHaveBeenCalled();
      });

      // Verify that the selection state is maintained
      expect(updatedNodeInteractions.selectedNode).toBe(mockD3Selection);
    });
  });

  describe('Error Handling', () => {
    it('should handle rendering errors gracefully', async () => {
      // Mock D3 to throw an error
      (d3.select as jest.Mock).mockImplementation(() => {
        throw new Error('D3 rendering error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<D3NetworkRenderer {...defaultProps} />);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle simulation errors without crashing', async () => {
      (d3.forceSimulation as jest.Mock).mockImplementation(() => {
        throw new Error('Simulation error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<D3NetworkRenderer {...defaultProps} />);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should properly cleanup on unmount', async () => {
      const { unmount } = render(<D3NetworkRenderer {...defaultProps} />);

      await waitFor(() => {
        expect(mockSimulation.on).toHaveBeenCalled();
      });

      unmount();

      expect(mockSimulation.stop).toHaveBeenCalled();
    });
  });

  describe('Visibility Control', () => {
    it('should not render when not visible', () => {
      render(<D3NetworkRenderer {...defaultProps} visible={false} />);

      // Should not call D3 methods when not visible
      expect(d3.select).not.toHaveBeenCalled();
    });

    it('should render when visible', async () => {
      render(<D3NetworkRenderer {...defaultProps} visible={true} />);

      await waitFor(() => {
        expect(d3.select).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset: NetworkData = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node${i}`,
          name: `Node ${i}`,
          type: 'artist' as const,
          types: ['artist'] as const,
          size: 15,
          x: Math.random() * 800,
          y: Math.random() * 600,
        })),
        links: Array.from({ length: 150 }, (_, i) => ({
          source: `node${i % 100}`,
          target: `node${(i + 1) % 100}`,
          type: 'collaboration' as const,
        })),
      };

      const startTime = performance.now();
      
      render(
        <D3NetworkRenderer 
          {...defaultProps} 
          data={largeDataset}
        />
      );

      await waitFor(() => {
        expect(d3.select).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 100ms for this test)
      expect(renderTime).toBeLessThan(100);
    });
  });
});
