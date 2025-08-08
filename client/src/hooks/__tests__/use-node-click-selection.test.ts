import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as d3 from 'd3';
import { useNodeInteractions } from '../use-node-interactions';
import { NetworkNode } from '@/types/network';

// Mock D3 selection
const mockSelection = {
  selectAll: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  datum: vi.fn()
};

// Mock tooltip
const mockTooltip = {
  showTooltip: vi.fn(),
  hideTooltip: vi.fn(),
  resetNodeHighlight: vi.fn(),
  setHighlightedNode: vi.fn(),
  isTooltipVisible: false,
  tooltipPosition: { x: 0, y: 0 },
  highlightedNode: null,
  currentNode: null,
  moveTooltip: vi.fn(),
  positionTooltipNearNode: vi.fn(),
  handleNetworkAction: vi.fn(),
  handleExpandAction: vi.fn(),
  handleProfileAction: vi.fn(),
  handleCollaborationAction: vi.fn()
};

// Mock simulation
const mockSimulation = {
  alphaTarget: vi.fn().mockReturnThis(),
  restart: vi.fn().mockReturnThis()
};

// Mock d3.select
vi.mock('d3', async () => {
  const actual = await vi.importActual('d3');
  return {
    ...actual,
    select: vi.fn(() => mockSelection),
    drag: vi.fn(() => ({
      on: vi.fn().mockReturnThis()
    }))
  };
});

describe('useNodeInteractions - Click Selection', () => {
  const mockSimulationRef = { current: mockSimulation };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection.selectAll.mockReturnValue(mockSelection);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Node Click Selection Mechanism', () => {
    it('should handle single-role node click with white stroke highlighting', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true
        })
      );

      const singleRoleNode: NetworkNode = {
        id: 'artist1',
        name: 'Taylor Swift',
        type: 'artist',
        size: 25,
        x: 100,
        y: 100
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      // Mock the datum method to return our node data
      mockSelection.datum.mockReturnValue(singleRoleNode);

      act(() => {
        result.current.handleNodeClick(mockEvent, singleRoleNode, mockNodeElement);
      });

      // Verify reset previous highlighting was called
      expect(mockTooltip.resetNodeHighlight).toHaveBeenCalled();

      // Verify d3.select was called with the node element
      expect(d3.select).toHaveBeenCalledWith(mockNodeElement);

      // Verify white stroke highlighting was applied
      expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke-width", 3);
      expect(mockSelection.style).toHaveBeenCalledWith("stroke-opacity", 1);

      // Verify node was set as highlighted
      expect(mockTooltip.setHighlightedNode).toHaveBeenCalledWith(mockSelection);

      // Verify tooltip was shown
      expect(mockTooltip.showTooltip).toHaveBeenCalledWith(mockEvent, singleRoleNode);
    });

    it('should handle multi-role node click with white stroke highlighting', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true
        })
      );

      const multiRoleNode: NetworkNode = {
        id: 'artist2',
        name: 'Jack Antonoff',
        type: 'artist',
        types: ['artist', 'producer', 'songwriter'],
        size: 25,
        x: 150,
        y: 150
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      // Mock the datum method to return our multi-role node data
      mockSelection.datum.mockReturnValue(multiRoleNode);

      act(() => {
        result.current.handleNodeClick(mockEvent, multiRoleNode, mockNodeElement);
      });

      // Verify reset previous highlighting was called
      expect(mockTooltip.resetNodeHighlight).toHaveBeenCalled();

      // Verify d3.select was called with the node element
      expect(d3.select).toHaveBeenCalledWith(mockNodeElement);

      // Verify white stroke highlighting was applied to both circles and paths
      expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke-width", 3);
      expect(mockSelection.style).toHaveBeenCalledWith("stroke-opacity", 1);

      // Verify node was set as highlighted
      expect(mockTooltip.setHighlightedNode).toHaveBeenCalledWith(mockSelection);

      // Verify tooltip was shown
      expect(mockTooltip.showTooltip).toHaveBeenCalledWith(mockEvent, multiRoleNode);
    });

    it('should prevent event propagation during click', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true
        })
      );

      const node: NetworkNode = {
        id: 'artist3',
        name: 'Ariana Grande',
        type: 'artist',
        size: 25,
        x: 200,
        y: 200
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const stopPropagationSpy = vi.spyOn(mockEvent, 'stopPropagation');
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, node, mockNodeElement);
      });

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should not handle click when component is not visible', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: false
        })
      );

      const node: NetworkNode = {
        id: 'artist4',
        name: 'Hidden Artist',
        type: 'artist',
        size: 25,
        x: 300,
        y: 300
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, node, mockNodeElement);
      });

      // Should not perform any highlighting when not visible
      expect(mockTooltip.resetNodeHighlight).not.toHaveBeenCalled();
      expect(d3.select).not.toHaveBeenCalled();
      expect(mockTooltip.setHighlightedNode).not.toHaveBeenCalled();
      expect(mockTooltip.showTooltip).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully during click selection', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true
        })
      );

      // Mock d3.select to throw an error
      const mockError = new Error('D3 selection error');
      const originalSelect = vi.mocked(d3.select);
      vi.mocked(d3.select).mockImplementationOnce(() => {
        throw mockError;
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const node: NetworkNode = {
        id: 'artist5',
        name: 'Error Artist',
        type: 'artist',
        size: 25,
        x: 400,
        y: 400
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      // Should not throw an error
      expect(() => {
        act(() => {
          result.current.handleNodeClick(mockEvent, node, mockNodeElement);
        });
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith('🎯 Error handling node click:', mockError);

      // Restore original mock
      vi.mocked(d3.select).mockImplementation(originalSelect);
      consoleErrorSpy.mockRestore();
    });

    it('should log click information for debugging', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true
        })
      );

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const node: NetworkNode = {
        id: 'artist6',
        name: 'Debug Artist',
        type: 'producer',
        size: 20,
        x: 500,
        y: 500
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, node, mockNodeElement);
      });

      // Check for the main log message
      expect(consoleLogSpy).toHaveBeenCalledWith('🎯 Node clicked: Debug Artist (producer)');

      consoleLogSpy.mockRestore();
    });
  });

  describe('Selection Reset Mechanism', () => {
    it('should reset highlighting before selecting new node', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true
        })
      );

      const firstNode: NetworkNode = {
        id: 'artist7',
        name: 'First Artist',
        type: 'artist',
        size: 25,
        x: 100,
        y: 100
      };

      const secondNode: NetworkNode = {
        id: 'artist8',
        name: 'Second Artist',
        type: 'artist',
        size: 25,
        x: 200,
        y: 200
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const mockNodeElement1 = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
      const mockNodeElement2 = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      // Click first node
      act(() => {
        result.current.handleNodeClick(mockEvent, firstNode, mockNodeElement1);
      });

      // Reset call count
      mockTooltip.resetNodeHighlight.mockClear();

      // Click second node
      act(() => {
        result.current.handleNodeClick(mockEvent, secondNode, mockNodeElement2);
      });

      // Should have called reset before highlighting the new node
      expect(mockTooltip.resetNodeHighlight).toHaveBeenCalledTimes(1);
    });
  });

  describe('White Stroke Visual Feedback', () => {
    it('should use the consistent selector for all node types', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true
        })
      );

      const node: NetworkNode = {
        id: 'artist',
        name: 'Artist',
        type: 'artist',
        size: 25,
        x: 100,
        y: 100
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, node, mockNodeElement);
      });

      // Verify the selector is called correctly
      expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
    });

    it('should apply white stroke attributes when selection succeeds', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true
        })
      );

      const node: NetworkNode = {
        id: 'multi',
        name: 'Multi Role Artist',
        type: 'artist',
        types: ['artist', 'producer'],
        size: 25,
        x: 100,
        y: 100
      };

      const mockEvent = new MouseEvent('click', { bubbles: true }) as MouseEvent;
      const mockNodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;

      act(() => {
        result.current.handleNodeClick(mockEvent, node, mockNodeElement);
      });

      // The selection mechanism should be called
      expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
      // D3 selection should be created
      expect(d3.select).toHaveBeenCalledWith(mockNodeElement);
    });
  });
});
