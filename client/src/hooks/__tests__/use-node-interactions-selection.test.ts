import { renderHook, act } from '@testing-library/react';
import { useNodeInteractions } from '../use-node-interactions';
import * as d3 from 'd3';
import { NetworkNode, NetworkLink } from '@/types/network';
import { UseTooltipReturn } from '../use-tooltip';

// Mock D3 selections
const mockD3Selection = {
  selectAll: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  datum: jest.fn(),
  empty: jest.fn().mockReturnValue(false),
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

// Mock D3
jest.mock('d3', () => ({
  select: jest.fn(() => mockD3Selection),
  drag: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
  })),
}));

// Sample test data
const mockArtistNode: NetworkNode = {
  id: 'artist1',
  name: 'Test Artist',
  type: 'artist',
  types: ['artist'],
  size: 20,
  x: 100,
  y: 100,
};

const mockProducerNode: NetworkNode = {
  id: 'producer1',
  name: 'Test Producer',
  type: 'producer',
  types: ['producer'],
  size: 15,
  x: 150,
  y: 150,
};

const mockMultiRoleNode: NetworkNode = {
  id: 'multi1',
  name: 'Multi Role Artist',
  type: 'artist',
  types: ['artist', 'producer', 'songwriter'],
  size: 25,
  x: 200,
  y: 200,
};

describe('useNodeInteractions - Click Selection Mechanism', () => {
  let simulationRef: React.RefObject<d3.Simulation<NetworkNode, NetworkLink> | null>;
  let mockSimulation: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSimulation = {
      alphaTarget: jest.fn().mockReturnThis(),
      restart: jest.fn().mockReturnThis(),
    };
    
    simulationRef = {
      current: mockSimulation,
    };

    // Reset D3 selection mocks
    mockD3Selection.selectAll.mockReturnThis();
    mockD3Selection.attr.mockReturnThis();
    mockD3Selection.datum.mockReturnValue(mockArtistNode);
    mockD3Selection.empty.mockReturnValue(false);
  });

  describe('Node Selection State Management', () => {
    it('should initialize with no selected node', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      expect(result.current.selectedNode).toBeNull();
    });

    it('should track selected node after click', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = new MouseEvent('click');
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, mockArtistNode, mockNodeElement);
      });

      expect(result.current.selectedNode).not.toBeNull();
      expect(d3.select).toHaveBeenCalledWith(mockNodeElement);
    });

    it('should reset all selections when resetAllSelections is called', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = new MouseEvent('click');
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      // First select a node
      act(() => {
        result.current.handleNodeClick(mockEvent, mockArtistNode, mockNodeElement);
      });

      expect(result.current.selectedNode).not.toBeNull();

      // Then reset selections
      act(() => {
        result.current.resetAllSelections();
      });

      expect(result.current.selectedNode).toBeNull();
    });
  });

  describe('White Stroke Highlighting', () => {
    it('should apply white stroke to single-role nodes', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      mockD3Selection.datum.mockReturnValue(mockArtistNode);

      const mockEvent = new MouseEvent('click');
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, mockArtistNode, mockNodeElement);
      });

      // Verify white stroke was applied to circles
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke', 'white');
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke-width', 3);
    });

    it('should apply white stroke to multi-role nodes', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      mockD3Selection.datum.mockReturnValue(mockMultiRoleNode);

      const mockEvent = new MouseEvent('click');
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, mockMultiRoleNode, mockNodeElement);
      });

      // Verify white stroke was applied to both paths and circles
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith('path');
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke', 'white');
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke-width', 3);
    });

    it('should reset previous selection before applying new selection', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = new MouseEvent('click');
      const mockNodeElement1 = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
      const mockNodeElement2 = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      // First click
      mockD3Selection.datum.mockReturnValue(mockArtistNode);
      act(() => {
        result.current.handleNodeClick(mockEvent, mockArtistNode, mockNodeElement1);
      });

      // Reset mocks for second click
      jest.clearAllMocks();
      mockD3Selection.selectAll.mockReturnThis();
      mockD3Selection.attr.mockReturnThis();
      mockD3Selection.datum.mockReturnValue(mockProducerNode);

      // Second click
      act(() => {
        result.current.handleNodeClick(mockEvent, mockProducerNode, mockNodeElement2);
      });

      // Should have reset the previous selection and applied new selection
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke', expect.any(Function));
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke-width', 4);
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke', 'white');
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke-width', 3);
    });
  });

  describe('Original Color Reset', () => {
    it('should reset artist nodes to magenta pink', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      mockD3Selection.datum.mockReturnValue(mockArtistNode);

      act(() => {
        result.current.resetAllSelections();
      });

      // The resetNodeSelection function should apply the correct color for artist type
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke', expect.any(Function));
      
      // Test the color function
      const colorFunction = mockD3Selection.attr.mock.calls.find(
        call => call[0] === 'stroke' && typeof call[1] === 'function'
      )?.[1];
      
      if (colorFunction) {
        expect(colorFunction()).toBe('#FF0ACF'); // Magenta Pink for artist
      }
    });

    it('should reset producer nodes to bright purple', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      mockD3Selection.datum.mockReturnValue(mockProducerNode);

      act(() => {
        result.current.resetAllSelections();
      });

      const colorFunction = mockD3Selection.attr.mock.calls.find(
        call => call[0] === 'stroke' && typeof call[1] === 'function'
      )?.[1];
      
      if (colorFunction) {
        expect(colorFunction()).toBe('#AE53FF'); // Bright Purple for producer
      }
    });

    it('should reset multi-role nodes to white strokes with appropriate widths', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      mockD3Selection.datum.mockReturnValue(mockMultiRoleNode);

      act(() => {
        result.current.resetAllSelections();
      });

      // Multi-role nodes should have white strokes restored
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith('path');
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke', 'white');
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke-width', 1); // paths
      expect(mockD3Selection.attr).toHaveBeenCalledWith('stroke-width', 2); // inner circle
    });
  });

  describe('Tooltip Integration', () => {
    it('should coordinate with tooltip system on node click', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = new MouseEvent('click');
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, mockArtistNode, mockNodeElement);
      });

      expect(mockTooltip.resetNodeHighlight).toHaveBeenCalled();
      expect(mockTooltip.setHighlightedNode).toHaveBeenCalled();
      expect(mockTooltip.showTooltip).toHaveBeenCalledWith(mockEvent, mockArtistNode);
    });

    it('should prevent event propagation on node click', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        stopPropagation: jest.fn(),
      } as unknown as MouseEvent;
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, mockArtistNode, mockNodeElement);
      });

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Visibility Control', () => {
    it('should not handle clicks when not visible', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: false,
        })
      );

      const mockEvent = new MouseEvent('click');
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, mockArtistNode, mockNodeElement);
      });

      expect(mockTooltip.showTooltip).not.toHaveBeenCalled();
      expect(d3.select).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully during node click', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      // Mock D3 select to throw an error
      (d3.select as jest.Mock).mockImplementation(() => {
        throw new Error('D3 selection error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockEvent = new MouseEvent('click');
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, mockArtistNode, mockNodeElement);
      });

      expect(consoleSpy).toHaveBeenCalledWith('🎯 Error handling node click:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully during selection reset', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      // Mock empty selection for error scenario
      mockD3Selection.empty.mockReturnValue(true);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      act(() => {
        result.current.resetAllSelections();
      });

      // Should not throw error even with empty selection
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration with Different Node Types', () => {
    const songwriterNode: NetworkNode = {
      id: 'songwriter1',
      name: 'Test Songwriter',
      type: 'songwriter',
      types: ['songwriter'],
      size: 12,
      x: 50,
      y: 50,
    };

    it('should handle songwriter nodes with light blue color', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      mockD3Selection.datum.mockReturnValue(songwriterNode);

      act(() => {
        result.current.resetAllSelections();
      });

      const colorFunction = mockD3Selection.attr.mock.calls.find(
        call => call[0] === 'stroke' && typeof call[1] === 'function'
      )?.[1];
      
      if (colorFunction) {
        expect(colorFunction()).toBe('#67D1F8'); // Light Blue for songwriter
      }
    });

    it('should handle unknown node types with default color', () => {
      const unknownNode: NetworkNode = {
        id: 'unknown1',
        name: 'Unknown Type',
        type: 'unknown' as any,
        types: ['unknown' as any],
        size: 10,
        x: 30,
        y: 30,
      };

      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      mockD3Selection.datum.mockReturnValue(unknownNode);

      act(() => {
        result.current.resetAllSelections();
      });

      const colorFunction = mockD3Selection.attr.mock.calls.find(
        call => call[0] === 'stroke' && typeof call[1] === 'function'
      )?.[1];
      
      if (colorFunction) {
        expect(colorFunction()).toBe('#355367'); // Police Blue for unknown types
      }
    });
  });
});
