import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import * as d3 from 'd3';
import { useZoom } from './use-zoom';

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(),
  zoom: vi.fn(),
  interpolate: vi.fn(),
}));

// Mock console methods to avoid noise in tests
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

Object.assign(console, mockConsole);

describe('useZoom', () => {
  let mockSvgRef: React.RefObject<SVGSVGElement>;
  let mockOnZoomChange: MockedFunction<(transform: { k: number; x: number; y: number }) => void>;
  let mockSvgElement: HTMLElement;
  let mockD3Selection: any;
  let mockZoomBehavior: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock SVG element
    mockSvgElement = {
      parentElement: {
        clientWidth: 800,
        clientHeight: 600,
      },
      getAttribute: vi.fn().mockReturnValue('0 0 800 600'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    // Create mock SVG ref
    mockSvgRef = {
      current: mockSvgElement,
    };

    // Create mock onZoomChange callback
    mockOnZoomChange = vi.fn();

    // Mock D3 selection - create a chainable mock
    mockD3Selection = {
      transition: vi.fn().mockReturnValue({
        duration: vi.fn().mockReturnValue({
          attrTween: vi.fn(),
          attr: vi.fn(),
        }),
      }),
      call: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      attr: vi.fn(),
    };

    // Mock D3 zoom behavior - create a chainable mock
    const mockZoomChain = {
      on: vi.fn().mockReturnThis(),
    };
    
    mockZoomBehavior = {
      scaleExtent: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue(mockZoomChain),
      }),
    };

    // Setup D3 mocks
    (d3.select as MockedFunction<typeof d3.select>).mockReturnValue(mockD3Selection);
    (d3.zoom as MockedFunction<typeof d3.zoom>).mockReturnValue(mockZoomBehavior);
    (d3.interpolate as MockedFunction<typeof d3.interpolate>).mockImplementation(
      (a, b) => (t: number) => a.map((av: number, i: number) => av + t * (b[i] - av))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default zoom level of 1', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      expect(result.current.currentZoom).toBe(1);
    });

    it('should provide all expected functions', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      expect(typeof result.current.handleZoomIn).toBe('function');
      expect(typeof result.current.handleZoomOut).toBe('function');
      expect(typeof result.current.handleZoomReset).toBe('function');
      expect(typeof result.current.applyZoom).toBe('function');
      expect(typeof result.current.applyPinchZoom).toBe('function');
      expect(typeof result.current.setupZoomBehavior).toBe('function');
    });
  });

  describe('zoom in/out functionality', () => {
    it('should increase zoom level when zooming in', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      act(() => {
        result.current.handleZoomIn();
      });

      expect(result.current.currentZoom).toBe(1.2); // 1 * 1.2
    });

    it('should decrease zoom level when zooming out', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      act(() => {
        result.current.handleZoomOut();
      });

      expect(result.current.currentZoom).toBeCloseTo(0.833, 2); // 1 / 1.2
    });

    it('should call applyZoom when zooming in', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      act(() => {
        result.current.handleZoomIn();
      });

      expect(mockD3Selection.transition).toHaveBeenCalled();
    });

    it('should call applyZoom when zooming out', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      act(() => {
        result.current.handleZoomOut();
      });

      expect(mockD3Selection.transition).toHaveBeenCalled();
    });
  });

  describe('zoom bounds', () => {
    it('should respect maximum zoom limit of 20x', async () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      // Zoom in multiple times to exceed limit
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          result.current.handleZoomIn();
        });
      }

      expect(result.current.currentZoom).toBe(20);
    });

    it('should respect minimum zoom limit of 0.05x', async () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      // Zoom out multiple times to exceed limit
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          result.current.handleZoomOut();
        });
      }

      expect(result.current.currentZoom).toBe(0.05);
    });
  });

  describe('zoom reset', () => {
    it('should reset zoom to 1x', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      // First zoom in
      act(() => {
        result.current.handleZoomIn();
      });

      expect(result.current.currentZoom).toBe(1.2);

      // Then reset
      act(() => {
        result.current.handleZoomReset();
      });

      expect(result.current.currentZoom).toBe(1);
    });

    it('should apply viewBox transition when resetting', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      act(() => {
        result.current.handleZoomReset();
      });

      expect(mockD3Selection.transition).toHaveBeenCalled();
    });

    it('should handle missing SVG ref gracefully', () => {
      const emptySvgRef = { current: null };
      const { result } = renderHook(() =>
        useZoom({
          svgRef: emptySvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      expect(() => {
        act(() => {
          result.current.handleZoomReset();
        });
      }).not.toThrow();
    });
  });

  describe('pinch zoom functionality', () => {
    it('should apply pinch zoom with focal point', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      act(() => {
        result.current.applyPinchZoom(2, 400, 300);
      });

      expect(mockD3Selection.transition).toHaveBeenCalled();
    });

    it('should handle missing SVG ref in pinch zoom', () => {
      const emptySvgRef = { current: null };
      const { result } = renderHook(() =>
        useZoom({
          svgRef: emptySvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      expect(() => {
        act(() => {
          result.current.applyPinchZoom(2, 400, 300);
        });
      }).not.toThrow();
    });
  });

  describe('D3 zoom behavior setup', () => {
    it('should setup D3 zoom behavior correctly', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      const mockNetworkGroup = mockD3Selection;

      act(() => {
        result.current.setupZoomBehavior(mockNetworkGroup);
      });

      expect(d3.zoom).toHaveBeenCalled();
      expect(mockZoomBehavior.scaleExtent).toHaveBeenCalledWith([0.05, 20]);
    });

    it('should disable D3 touch events', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      const mockNetworkGroup = mockD3Selection;

      act(() => {
        result.current.setupZoomBehavior(mockNetworkGroup);
      });

      expect(mockD3Selection.on).toHaveBeenCalledWith("mousedown.drag", null);
      expect(mockD3Selection.on).toHaveBeenCalledWith("click.zoom", null);
      expect(mockD3Selection.on).toHaveBeenCalledWith("dblclick.zoom", null);
      expect(mockD3Selection.on).toHaveBeenCalledWith("touchstart.zoom", null);
      expect(mockD3Selection.on).toHaveBeenCalledWith("touchmove.zoom", null);
      expect(mockD3Selection.on).toHaveBeenCalledWith("touchend.zoom", null);
    });
  });

  describe('custom zoom events', () => {
    it('should handle "in" zoom event', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      const customEvent = new CustomEvent('network-zoom', {
        detail: { action: 'in' }
      });

      act(() => {
        window.dispatchEvent(customEvent);
      });

      expect(result.current.currentZoom).toBe(1.2);
    });

    it('should handle "out" zoom event', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      const customEvent = new CustomEvent('network-zoom', {
        detail: { action: 'out' }
      });

      act(() => {
        window.dispatchEvent(customEvent);
      });

      expect(result.current.currentZoom).toBeCloseTo(0.833, 2);
    });

    it('should handle "reset" zoom event', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      // First zoom in
      act(() => {
        result.current.handleZoomIn();
      });

      const customEvent = new CustomEvent('network-zoom', {
        detail: { action: 'reset' }
      });

      act(() => {
        window.dispatchEvent(customEvent);
      });

      expect(result.current.currentZoom).toBe(1);
    });

    it('should not handle events when not visible', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: false,
          onZoomChange: mockOnZoomChange,
        })
      );

      const customEvent = new CustomEvent('network-zoom', {
        detail: { action: 'in' }
      });

      act(() => {
        window.dispatchEvent(customEvent);
      });

      expect(result.current.currentZoom).toBe(1); // Should remain unchanged
    });
  });

  describe('touch and wheel event handling', () => {
    it('should add event listeners when visible', () => {
      renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      expect(mockSvgElement.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { passive: false }
      );
      expect(mockSvgElement.addEventListener).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        { passive: false }
      );
      expect(mockSvgElement.addEventListener).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function),
        { passive: false }
      );
      expect(mockSvgElement.addEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        { passive: false }
      );
    });

    it('should not add event listeners when not visible', () => {
      renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: false,
          onZoomChange: mockOnZoomChange,
        })
      );

      expect(mockSvgElement.addEventListener).not.toHaveBeenCalled();
    });

    it('should remove event listeners on cleanup', () => {
      const { unmount } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      unmount();

      expect(mockSvgElement.removeEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function)
      );
      expect(mockSvgElement.removeEventListener).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function)
      );
      expect(mockSvgElement.removeEventListener).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function)
      );
      expect(mockSvgElement.removeEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function)
      );
    });
  });

  describe('memoization and performance', () => {
    it('should memoize zoom functions', () => {
      const { result, rerender } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      const firstRenderFunctions = {
        handleZoomIn: result.current.handleZoomIn,
        handleZoomOut: result.current.handleZoomOut,
        handleZoomReset: result.current.handleZoomReset,
        applyZoom: result.current.applyZoom,
        applyPinchZoom: result.current.applyPinchZoom,
      };

      rerender();

      // Functions should be the same reference due to useCallback
      expect(result.current.handleZoomIn).toBe(firstRenderFunctions.handleZoomIn);
      expect(result.current.handleZoomOut).toBe(firstRenderFunctions.handleZoomOut);
      expect(result.current.handleZoomReset).toBe(firstRenderFunctions.handleZoomReset);
      expect(result.current.applyZoom).toBe(firstRenderFunctions.applyZoom);
      expect(result.current.applyPinchZoom).toBe(firstRenderFunctions.applyPinchZoom);
    });
  });

  describe('error handling', () => {
    it('should handle D3 selection errors gracefully', () => {
      (d3.select as MockedFunction<typeof d3.select>).mockImplementation(() => {
        throw new Error('D3 error');
      });

      expect(() => {
        renderHook(() =>
          useZoom({
            svgRef: mockSvgRef,
            visible: true,
            onZoomChange: mockOnZoomChange,
          })
        );
      }).not.toThrow();
    });

    it('should handle missing parent element', () => {
      const svgRefWithoutParent = {
        current: {
          ...mockSvgElement,
          parentElement: null,
        },
      };

      const { result } = renderHook(() =>
        useZoom({
          svgRef: svgRefWithoutParent,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      expect(() => {
        act(() => {
          result.current.handleZoomIn();
        });
      }).not.toThrow();
    });
  });

  describe('console logging', () => {
    it('should log zoom changes', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      act(() => {
        result.current.handleZoomIn();
      });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Zooming from 1.00 to 1.20')
      );
    });

    it('should log zoom reset', () => {
      const { result } = renderHook(() =>
        useZoom({
          svgRef: mockSvgRef,
          visible: true,
          onZoomChange: mockOnZoomChange,
        })
      );

      act(() => {
        result.current.handleZoomReset();
      });

      expect(mockConsole.log).toHaveBeenCalledWith(
        'Zoom and position reset to center'
      );
    });
  });
}); 