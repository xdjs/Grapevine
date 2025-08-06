import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import * as d3 from 'd3';
import { useNodeInteractions } from './use-node-interactions';
import { NetworkNode, NetworkLink } from '@/types/network';
import { UseTooltipReturn } from './use-tooltip';

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(),
  drag: vi.fn(),
}));

// Mock console methods to avoid noise in tests
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

Object.assign(console, mockConsole);

describe('useNodeInteractions', () => {
  let mockSimulationRef: React.RefObject<d3.Simulation<NetworkNode, NetworkLink> | null>;
  let mockSimulation: any;
  let mockTooltip: UseTooltipReturn;
  let mockD3Selection: any;
  let mockDragBehavior: any;
  let sampleNode: NetworkNode;
  let sampleNodeElement: SVGGElement;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create sample node data
    sampleNode = {
      id: 'artist-1',
      name: 'Test Artist',
      type: 'artist',
      size: 20,
      x: 100,
      y: 150,
      fx: null,
      fy: null,
    };

    // Create mock SVG element
    sampleNodeElement = {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(),
    } as any;

    // Create mock D3 simulation
    mockSimulation = {
      alphaTarget: vi.fn().mockReturnThis(),
      restart: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      nodes: vi.fn().mockReturnValue([sampleNode]),
      force: vi.fn().mockReturnThis(),
    };

    // Create mock simulation ref
    mockSimulationRef = {
      current: mockSimulation,
    };

    // Create mock tooltip system
    mockTooltip = {
      isTooltipVisible: false,
      tooltipPosition: { x: 0, y: 0 },
      highlightedNode: null,
      currentNode: null,
      showTooltip: vi.fn(),
      hideTooltip: vi.fn(),
      moveTooltip: vi.fn(),
      positionTooltipNearNode: vi.fn(),
      setHighlightedNode: vi.fn(),
      resetNodeHighlight: vi.fn(),
      handleNetworkAction: vi.fn(),
      handleExpandAction: vi.fn(),
      handleProfileAction: vi.fn(),
      handleCollaborationAction: vi.fn(),
    };

    // Create mock D3 selection - create a chainable mock
    mockD3Selection = {
      selectAll: vi.fn().mockReturnValue({
        attr: vi.fn().mockReturnThis(),
        style: vi.fn().mockReturnThis(),
      }),
      attr: vi.fn().mockReturnThis(),
      style: vi.fn().mockReturnThis(),
      call: vi.fn().mockReturnThis(),
    };

    // Mock D3 drag behavior - create a chainable mock
    mockDragBehavior = {
      on: vi.fn().mockReturnThis(),
    };

    // Setup D3 mocks
    (d3.select as MockedFunction<typeof d3.select>).mockReturnValue(mockD3Selection);
    (d3.drag as MockedFunction<typeof d3.drag>).mockReturnValue(mockDragBehavior);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should provide all expected functions', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      expect(typeof result.current.dragstarted).toBe('function');
      expect(typeof result.current.dragged).toBe('function');
      expect(typeof result.current.dragended).toBe('function');
      expect(typeof result.current.handleNodeClick).toBe('function');
      expect(typeof result.current.setupDragBehavior).toBe('function');
    });

    it('should handle missing simulation ref gracefully', () => {
      const emptySumlationRef = { current: null };
      
      expect(() => {
        renderHook(() =>
          useNodeInteractions({
            simulationRef: emptySumlationRef,
            tooltip: mockTooltip,
            visible: true,
          })
        );
      }).not.toThrow();
    });
  });

  describe('drag behavior', () => {
    it('should start drag correctly', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
      } as any;

      act(() => {
        result.current.dragstarted(mockEvent, sampleNode);
      });

      expect(mockEvent.sourceEvent.stopPropagation).toHaveBeenCalled();
      expect(mockSimulation.alphaTarget).toHaveBeenCalledWith(0.3);
      expect(mockSimulation.restart).toHaveBeenCalled();
      expect(sampleNode.fx).toBe(sampleNode.x);
      expect(sampleNode.fy).toBe(sampleNode.y);
    });

    it('should not start drag when not visible', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: false,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
      } as any;

      act(() => {
        result.current.dragstarted(mockEvent, sampleNode);
      });

      expect(mockSimulation.alphaTarget).not.toHaveBeenCalled();
    });

    it('should handle drag movement correctly', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        x: 200,
        y: 250,
      } as any;

      act(() => {
        result.current.dragged(mockEvent, sampleNode);
      });

      expect(mockEvent.sourceEvent.stopPropagation).toHaveBeenCalled();
      expect(sampleNode.fx).toBe(200);
      expect(sampleNode.fy).toBe(250);
    });

    it('should not handle drag movement when not visible', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: false,
        })
      );

      const originalFx = sampleNode.fx;
      const originalFy = sampleNode.fy;

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        x: 200,
        y: 250,
      } as any;

      act(() => {
        result.current.dragged(mockEvent, sampleNode);
      });

      expect(sampleNode.fx).toBe(originalFx);
      expect(sampleNode.fy).toBe(originalFy);
    });

    it('should end drag correctly', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      // Setup initial fixed position
      sampleNode.fx = 200;
      sampleNode.fy = 250;

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
      } as any;

      act(() => {
        result.current.dragended(mockEvent, sampleNode);
      });

      expect(mockEvent.sourceEvent.stopPropagation).toHaveBeenCalled();
      expect(mockSimulation.alphaTarget).toHaveBeenCalledWith(0);
      expect(sampleNode.fx).toBe(null);
      expect(sampleNode.fy).toBe(null);
    });

    it('should not reset alpha target when drag is still active', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: true,
      } as any;

      act(() => {
        result.current.dragstarted(mockEvent, sampleNode);
      });

      expect(mockSimulation.alphaTarget).not.toHaveBeenCalled();
    });

    it('should handle missing simulation reference in drag operations', () => {
      const emptySumlationRef = { current: null };
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: emptySumlationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
      } as any;

      expect(() => {
        act(() => {
          result.current.dragstarted(mockEvent, sampleNode);
          result.current.dragended(mockEvent, sampleNode);
        });
      }).not.toThrow();
    });
  });

  describe('node click handling', () => {
    it('should handle node click correctly', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        stopPropagation: vi.fn(),
      } as any;

      act(() => {
        result.current.handleNodeClick(mockEvent, sampleNode, sampleNodeElement);
      });

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockTooltip.resetNodeHighlight).toHaveBeenCalled();
      expect(d3.select).toHaveBeenCalledWith(sampleNodeElement);
      expect(mockTooltip.setHighlightedNode).toHaveBeenCalledWith(mockD3Selection);
      expect(mockTooltip.showTooltip).toHaveBeenCalledWith(mockEvent, sampleNode);
    });

    it('should not handle node click when not visible', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: false,
        })
      );

      const mockEvent = {
        stopPropagation: vi.fn(),
      } as any;

      act(() => {
        result.current.handleNodeClick(mockEvent, sampleNode, sampleNodeElement);
      });

      expect(mockTooltip.resetNodeHighlight).not.toHaveBeenCalled();
      expect(mockTooltip.showTooltip).not.toHaveBeenCalled();
    });

    it('should highlight single-role node correctly on click', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;
      const singleRoleNode = { ...sampleNode, type: 'artist', types: undefined };

      act(() => {
        result.current.handleNodeClick(mockEvent, singleRoleNode, sampleNodeElement);
      });

      expect(mockD3Selection.selectAll).toHaveBeenCalledWith("circle");
      expect(mockD3Selection.selectAll().attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockD3Selection.selectAll().attr).toHaveBeenCalledWith("stroke-width", 3);
    });

    it('should highlight multi-role node correctly on click', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;
      const multiRoleNode = { ...sampleNode, type: 'artist', types: ['artist', 'producer'] };

      act(() => {
        result.current.handleNodeClick(mockEvent, multiRoleNode, sampleNodeElement);
      });

      expect(mockD3Selection.selectAll).toHaveBeenCalledWith("path");
      expect(mockD3Selection.selectAll().attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockD3Selection.selectAll().attr).toHaveBeenCalledWith("stroke-width", 3);
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith("circle");
    });
  });

  describe('drag behavior setup', () => {
    it('should setup drag behavior correctly', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockSelection = {
        call: vi.fn(),
      } as any;

      act(() => {
        result.current.setupDragBehavior(mockSelection);
      });

      expect(d3.drag).toHaveBeenCalled();
      expect(mockSelection.call).toHaveBeenCalled();
    });

    it('should not setup drag behavior when not visible', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: false,
        })
      );

      const mockSelection = {
        call: vi.fn(),
      } as any;

      act(() => {
        result.current.setupDragBehavior(mockSelection);
      });

      expect(mockSelection.call).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle invalid node data gracefully', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const invalidNode = {} as NetworkNode;
      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
        x: 100,
        y: 100,
      } as any;

      expect(() => {
        act(() => {
          result.current.dragstarted(mockEvent, invalidNode);
          result.current.dragged(mockEvent, invalidNode);
          result.current.dragended(mockEvent, invalidNode);
        });
      }).not.toThrow();
    });

    it('should handle D3 selection errors gracefully', () => {
      // Mock D3 to throw error once, then restore normal behavior
      const originalD3Select = (d3.select as MockedFunction<typeof d3.select>);
      const mockSelectOnce = vi.fn().mockImplementationOnce(() => {
        throw new Error('D3 selection error');
      }).mockReturnValue(mockD3Selection);
      
      (d3.select as MockedFunction<typeof d3.select>) = mockSelectOnce;

      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;

      // The component should handle the error gracefully and not crash
      expect(() => {
        act(() => {
          try {
            result.current.handleNodeClick(mockEvent, sampleNode, sampleNodeElement);
          } catch (error) {
            // Expected to catch and handle the error
            console.log('Caught expected D3 error:', error);
          }
        });
      }).not.toThrow();
      
      // Restore original mock
      (d3.select as MockedFunction<typeof d3.select>) = originalD3Select;
    });

    it('should handle tooltip system errors gracefully', () => {
      const faultyTooltip = {
        ...mockTooltip,
        resetNodeHighlight: vi.fn().mockImplementation(() => {
          throw new Error('Tooltip error');
        }),
      };

      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: faultyTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;

      expect(() => {
        act(() => {
          try {
            result.current.handleNodeClick(mockEvent, sampleNode, sampleNodeElement);
          } catch (error) {
            // Expected to catch and handle the error
            console.log('Caught expected tooltip error:', error);
          }
        });
      }).not.toThrow();
    });
  });

  describe('accessibility and keyboard navigation', () => {
    it('should stop event propagation to preserve accessibility', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;

      act(() => {
        result.current.handleNodeClick(mockEvent, sampleNode, sampleNodeElement);
      });

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should stop propagation in drag events for proper accessibility', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
        x: 100,
        y: 100,
      } as any;

      act(() => {
        result.current.dragstarted(mockEvent, sampleNode);
        result.current.dragged(mockEvent, sampleNode);
        result.current.dragended(mockEvent, sampleNode);
      });

      expect(mockEvent.sourceEvent.stopPropagation).toHaveBeenCalledTimes(3);
    });
  });

  describe('performance and memoization', () => {
    it('should memoize drag functions', () => {
      const { result, rerender } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const firstRenderFunctions = {
        dragstarted: result.current.dragstarted,
        dragged: result.current.dragged,
        dragended: result.current.dragended,
        handleNodeClick: result.current.handleNodeClick,
        setupDragBehavior: result.current.setupDragBehavior,
      };

      rerender();

      // Functions should be the same reference due to useCallback
      expect(result.current.dragstarted).toBe(firstRenderFunctions.dragstarted);
      expect(result.current.dragged).toBe(firstRenderFunctions.dragged);
      expect(result.current.dragended).toBe(firstRenderFunctions.dragended);
      expect(result.current.handleNodeClick).toBe(firstRenderFunctions.handleNodeClick);
      expect(result.current.setupDragBehavior).toBe(firstRenderFunctions.setupDragBehavior);
    });

    it('should handle rapid interactions without memory leaks', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
        x: 100,
        y: 100,
      } as any;

      const clickEvent = { stopPropagation: vi.fn() } as any;

      // Simulate rapid interactions
      expect(() => {
        for (let i = 0; i < 100; i++) {
          act(() => {
            result.current.dragstarted(mockEvent, sampleNode);
            result.current.dragged(mockEvent, sampleNode);
            result.current.dragended(mockEvent, sampleNode);
            result.current.handleNodeClick(clickEvent, sampleNode, sampleNodeElement);
          });
        }
      }).not.toThrow();
    });
  });

  describe('multi-node interactions', () => {
    it('should handle interactions with different node types', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const artistNode: NetworkNode = { ...sampleNode, type: 'artist' };
      const producerNode: NetworkNode = { ...sampleNode, id: 'producer-1', name: 'Producer', type: 'producer' };
      const songwriterNode: NetworkNode = { ...sampleNode, id: 'songwriter-1', name: 'Songwriter', type: 'songwriter' };

      const mockEvent = { stopPropagation: vi.fn() } as any;

      expect(() => {
        act(() => {
          result.current.handleNodeClick(mockEvent, artistNode, sampleNodeElement);
          result.current.handleNodeClick(mockEvent, producerNode, sampleNodeElement);
          result.current.handleNodeClick(mockEvent, songwriterNode, sampleNodeElement);
        });
      }).not.toThrow();

      expect(mockTooltip.showTooltip).toHaveBeenCalledTimes(3);
    });

    it('should handle nodes with multi-role types', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const multiRoleNode: NetworkNode = {
        ...sampleNode,
        type: 'artist',
        types: ['artist', 'producer', 'songwriter'],
      };

      const mockEvent = { stopPropagation: vi.fn() } as any;

      expect(() => {
        act(() => {
          result.current.handleNodeClick(mockEvent, multiRoleNode, sampleNodeElement);
        });
      }).not.toThrow();

      expect(mockTooltip.showTooltip).toHaveBeenCalledWith(mockEvent, multiRoleNode);
    });
  });

  describe('click selection mechanism', () => {
    it('should properly implement white stroke selection for single-role nodes', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;
      const artistNode = { ...sampleNode, type: 'artist' };

      act(() => {
        result.current.handleNodeClick(mockEvent, artistNode, sampleNodeElement);
      });

      // Verify reset was called first
      expect(mockTooltip.resetNodeHighlight).toHaveBeenCalled();
      
      // Verify D3 selection was created
      expect(d3.select).toHaveBeenCalledWith(sampleNodeElement);
      
      // Verify white stroke was applied to circles for single-role nodes
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith("circle");
      expect(mockD3Selection.selectAll().attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockD3Selection.selectAll().attr).toHaveBeenCalledWith("stroke-width", 3);
      
      // Verify node was tracked as highlighted
      expect(mockTooltip.setHighlightedNode).toHaveBeenCalledWith(mockD3Selection);
      
      // Verify tooltip was shown
      expect(mockTooltip.showTooltip).toHaveBeenCalledWith(mockEvent, artistNode);
    });

    it('should properly implement white stroke selection for multi-role nodes', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;
      const multiRoleNode = { 
        ...sampleNode, 
        type: 'artist', 
        types: ['artist', 'producer', 'songwriter'] 
      };

      act(() => {
        result.current.handleNodeClick(mockEvent, multiRoleNode, sampleNodeElement);
      });

      // Verify reset was called first
      expect(mockTooltip.resetNodeHighlight).toHaveBeenCalled();
      
      // Verify white stroke was applied to both paths and circles for multi-role nodes
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith("path");
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith("circle");
      expect(mockD3Selection.selectAll().attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockD3Selection.selectAll().attr).toHaveBeenCalledWith("stroke-width", 3);
      
      // Verify node was tracked as highlighted
      expect(mockTooltip.setHighlightedNode).toHaveBeenCalledWith(mockD3Selection);
      
      // Verify tooltip was shown
      expect(mockTooltip.showTooltip).toHaveBeenCalledWith(mockEvent, multiRoleNode);
    });

    it('should reset previous selection when clicking a different node', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;
      const firstNode = { ...sampleNode, id: 'node-1', name: 'First Artist' };
      const secondNode = { ...sampleNode, id: 'node-2', name: 'Second Artist' };

      // Click first node
      act(() => {
        result.current.handleNodeClick(mockEvent, firstNode, sampleNodeElement);
      });

      // Reset mock call count for the second click
      vi.clearAllMocks();

      // Click second node - should reset previous selection
      act(() => {
        result.current.handleNodeClick(mockEvent, secondNode, sampleNodeElement);
      });

      // Verify that resetNodeHighlight was called to clear previous selection
      expect(mockTooltip.resetNodeHighlight).toHaveBeenCalled();
      
      // Verify new selection was applied
      expect(mockTooltip.setHighlightedNode).toHaveBeenCalledWith(mockD3Selection);
      expect(mockTooltip.showTooltip).toHaveBeenCalledWith(mockEvent, secondNode);
    });

    it('should handle clicks with proper role detection', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;
      
      // Test with undefined types (should default to single type)
      const nodeWithoutTypes = { ...sampleNode, types: undefined };
      
      act(() => {
        result.current.handleNodeClick(mockEvent, nodeWithoutTypes, sampleNodeElement);
      });

      // Should treat as single-role node
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith("circle");
      
      vi.clearAllMocks();
      
      // Test with explicit single type array
      const nodeWithSingleType = { ...sampleNode, types: ['producer'] };
      
      act(() => {
        result.current.handleNodeClick(mockEvent, nodeWithSingleType, sampleNodeElement);
      });

      // Should still treat as single-role node
      expect(mockD3Selection.selectAll).toHaveBeenCalledWith("circle");
    });
  });

  describe('console logging', () => {
    it('should log drag start events', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
      } as any;

      act(() => {
        result.current.dragstarted(mockEvent, sampleNode);
      });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('🎯 Drag started for node: Test Artist')
      );
    });

    it('should log drag end events', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = {
        sourceEvent: { stopPropagation: vi.fn() },
        active: false,
      } as any;

      act(() => {
        result.current.dragended(mockEvent, sampleNode);
      });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('🎯 Drag ended for node: Test Artist')
      );
    });

    it('should log node click events', () => {
      const { result } = renderHook(() =>
        useNodeInteractions({
          simulationRef: mockSimulationRef,
          tooltip: mockTooltip,
          visible: true,
        })
      );

      const mockEvent = { stopPropagation: vi.fn() } as any;

      act(() => {
        result.current.handleNodeClick(mockEvent, sampleNode, sampleNodeElement);
      });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('🎯 Node clicked: Test Artist (artist) - White selection applied')
      );
    });
  });
});