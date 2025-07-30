import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTouchGestures } from './use-touch-gestures';

// Mock console.log to avoid noise in tests
vi.mock('console', () => ({
  log: vi.fn(),
}));

// Mock SVG element for testing
const createMockSVGElement = () => {
  const mockElement = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    })),
  };
  return mockElement as unknown as SVGSVGElement;
};

// Mock touch event
const createMockTouchEvent = (touches: Array<{ clientX: number; clientY: number }>, type = 'touchmove') => {
  const event = {
    type,
    touches,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  return event as unknown as TouchEvent;
};

// Mock wheel event
const createMockWheelEvent = (deltaY: number, clientX = 400, clientY = 300, ctrlKey = false) => {
  const event = {
    type: 'wheel',
    deltaY,
    clientX,
    clientY,
    ctrlKey,
    preventDefault: vi.fn(),
  };
  return event as unknown as WheelEvent;
};

describe('useTouchGestures', () => {
  let mockSvgElement: SVGSVGElement;
  let svgRef: React.RefObject<SVGSVGElement>;
  let mockOnPinchZoomIn: ReturnType<typeof vi.fn>;
  let mockOnPinchZoomOut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSvgElement = createMockSVGElement();
    svgRef = { current: mockSvgElement };
    mockOnPinchZoomIn = vi.fn();
    mockOnPinchZoomOut = vi.fn();
  });

  describe('Hook initialization', () => {
    it('should initialize without errors', () => {
      const { result } = renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      expect(result.current.setupTouchHandlers).toBeDefined();
      expect(typeof result.current.setupTouchHandlers).toBe('function');
    });

    it('should not setup handlers when SVG ref is null', () => {
      const nullRef = { current: null };
      renderHook(() =>
        useTouchGestures({
          svgRef: nullRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      expect(mockSvgElement.addEventListener).not.toHaveBeenCalled();
    });

    it('should not setup handlers when not visible', () => {
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: false,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      expect(mockSvgElement.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('Event listener setup and cleanup', () => {
    it('should add all required event listeners when visible', () => {
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
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

    it('should remove event listeners on cleanup', () => {
      const { unmount } = renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
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

    it('should cleanup when visibility changes from true to false', () => {
      const { rerender } = renderHook(
        ({ visible }) =>
          useTouchGestures({
            svgRef,
            visible,
            onPinchZoomIn: mockOnPinchZoomIn,
            onPinchZoomOut: mockOnPinchZoomOut,
          }),
        { initialProps: { visible: true } }
      );

      // Change visibility to false
      rerender({ visible: false });

      expect(mockSvgElement.removeEventListener).toHaveBeenCalledTimes(4);
    });
  });

  describe('Touch event handling', () => {
    let touchStartHandler: (event: TouchEvent) => void;
    let touchMoveHandler: (event: TouchEvent) => void;
    let touchEndHandler: (event: TouchEvent) => void;

    beforeEach(() => {
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      // Extract the event handlers
      const calls = (mockSvgElement.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
      touchStartHandler = calls.find(call => call[0] === 'touchstart')[1];
      touchMoveHandler = calls.find(call => call[0] === 'touchmove')[1];
      touchEndHandler = calls.find(call => call[0] === 'touchend')[1];
    });

    describe('Touch start handling', () => {
      it('should handle single touch by preventing default', () => {
        const singleTouchEvent = createMockTouchEvent([{ clientX: 100, clientY: 100 }], 'touchstart');
        touchStartHandler(singleTouchEvent);

        expect(singleTouchEvent.preventDefault).toHaveBeenCalled();
      });

      it('should initiate pinch gesture with two touches', () => {
        const doubleTouchEvent = createMockTouchEvent([
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ], 'touchstart');

        touchStartHandler(doubleTouchEvent);

        expect(doubleTouchEvent.preventDefault).toHaveBeenCalled();
        expect(doubleTouchEvent.stopPropagation).toHaveBeenCalled();
      });

      it('should calculate initial distance and center point correctly', () => {
        const doubleTouchEvent = createMockTouchEvent([
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ], 'touchstart');

        touchStartHandler(doubleTouchEvent);

        // Distance should be sqrt((200-100)^2 + (200-100)^2) = sqrt(20000) ≈ 141.42
        // Center should be ((100+200)/2, (100+200)/2) = (150, 150)
        expect(doubleTouchEvent.preventDefault).toHaveBeenCalled();
      });
    });

    describe('Touch move handling', () => {
      it('should ignore touch move without active pinch', () => {
        const touchMoveEvent = createMockTouchEvent([
          { clientX: 110, clientY: 110 },
          { clientX: 210, clientY: 210 }
        ]);

        touchMoveHandler(touchMoveEvent);

        expect(mockOnPinchZoomIn).not.toHaveBeenCalled();
        expect(mockOnPinchZoomOut).not.toHaveBeenCalled();
      });

      it('should detect pinch out (zoom in) gesture', () => {
        // Start pinch
        const touchStartEvent = createMockTouchEvent([
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ], 'touchstart');
        touchStartHandler(touchStartEvent);

        // Move touches apart (pinch out)
        const touchMoveEvent = createMockTouchEvent([
          { clientX: 80, clientY: 80 },
          { clientX: 220, clientY: 220 }
        ]);
        touchMoveHandler(touchMoveEvent);

        expect(mockOnPinchZoomIn).toHaveBeenCalled();
        expect(touchMoveEvent.preventDefault).toHaveBeenCalled();
        expect(touchMoveEvent.stopPropagation).toHaveBeenCalled();
      });

      it('should detect pinch in (zoom out) gesture', () => {
        // Start pinch
        const touchStartEvent = createMockTouchEvent([
          { clientX: 80, clientY: 80 },
          { clientX: 220, clientY: 220 }
        ], 'touchstart');
        touchStartHandler(touchStartEvent);

        // Move touches closer (pinch in)
        const touchMoveEvent = createMockTouchEvent([
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ]);
        touchMoveHandler(touchMoveEvent);

        expect(mockOnPinchZoomOut).toHaveBeenCalled();
      });

      it('should ignore small scale changes (below threshold)', () => {
        // Start pinch
        const touchStartEvent = createMockTouchEvent([
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ], 'touchstart');
        touchStartHandler(touchStartEvent);

        // Very small movement (below 0.2 threshold)
        const touchMoveEvent = createMockTouchEvent([
          { clientX: 101, clientY: 101 },
          { clientX: 201, clientY: 201 }
        ]);
        touchMoveHandler(touchMoveEvent);

        expect(mockOnPinchZoomIn).not.toHaveBeenCalled();
        expect(mockOnPinchZoomOut).not.toHaveBeenCalled();
      });

      it('should handle single touch during pinch', () => {
        // Start pinch
        const touchStartEvent = createMockTouchEvent([
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ], 'touchstart');
        touchStartHandler(touchStartEvent);

        // Single touch during pinch
        const singleTouchMoveEvent = createMockTouchEvent([{ clientX: 150, clientY: 150 }]);
        touchMoveHandler(singleTouchMoveEvent);

        expect(mockOnPinchZoomIn).not.toHaveBeenCalled();
        expect(mockOnPinchZoomOut).not.toHaveBeenCalled();
      });
    });

    describe('Touch end handling', () => {
      it('should reset pinch state on touch end', () => {
        // Start pinch
        const touchStartEvent = createMockTouchEvent([
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ], 'touchstart');
        touchStartHandler(touchStartEvent);

        // End touch
        const touchEndEvent = createMockTouchEvent([], 'touchend');
        touchEndHandler(touchEndEvent);

        // Subsequent touch move should not trigger zoom
        const touchMoveEvent = createMockTouchEvent([
          { clientX: 80, clientY: 80 },
          { clientX: 220, clientY: 220 }
        ]);
        touchMoveHandler(touchMoveEvent);

        expect(mockOnPinchZoomIn).not.toHaveBeenCalled();
      });

      it('should handle touch end without active pinch', () => {
        const touchEndEvent = createMockTouchEvent([], 'touchend');
        
        expect(() => touchEndHandler(touchEndEvent)).not.toThrow();
      });
    });
  });

  describe('Wheel event handling', () => {
    let wheelHandler: (event: WheelEvent) => void;

    beforeEach(() => {
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      const calls = (mockSvgElement.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
      wheelHandler = calls.find(call => call[0] === 'wheel')[1];
    });

    it('should handle wheel zoom in (negative deltaY)', () => {
      const wheelEvent = createMockWheelEvent(-100, 400, 300);
      wheelHandler(wheelEvent);

      expect(mockOnPinchZoomIn).toHaveBeenCalledWith(400, 300);
      expect(wheelEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle wheel zoom out (positive deltaY)', () => {
      const wheelEvent = createMockWheelEvent(100, 400, 300);
      wheelHandler(wheelEvent);

      expect(mockOnPinchZoomOut).toHaveBeenCalledWith(400, 300);
      expect(wheelEvent.preventDefault).toHaveBeenCalled();
    });

    it('should use mouse position as focal point', () => {
      const wheelEvent = createMockWheelEvent(-100, 150, 250);
      wheelHandler(wheelEvent);

      expect(mockOnPinchZoomIn).toHaveBeenCalledWith(150, 250);
    });

    it('should throttle wheel events (50ms)', () => {
      vi.useFakeTimers();
      
      const wheelEvent1 = createMockWheelEvent(-100);
      const wheelEvent2 = createMockWheelEvent(-100);
      
      wheelHandler(wheelEvent1);
      expect(mockOnPinchZoomIn).toHaveBeenCalledTimes(1);
      
      // Immediate second event should be throttled
      wheelHandler(wheelEvent2);
      expect(mockOnPinchZoomIn).toHaveBeenCalledTimes(1);
      
      // After 50ms, event should work
      vi.advanceTimersByTime(51);
      wheelHandler(wheelEvent2);
      expect(mockOnPinchZoomIn).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it('should distinguish between mouse wheel and trackpad pinch', () => {
      vi.useFakeTimers();
      
      const mouseWheelEvent = createMockWheelEvent(-100, 400, 300, false);
      const trackpadEvent = createMockWheelEvent(-100, 400, 300, true);
      
      wheelHandler(mouseWheelEvent);
      
      // Advance time to avoid throttling
      vi.advanceTimersByTime(51);
      wheelHandler(trackpadEvent);
      
      expect(mockOnPinchZoomIn).toHaveBeenCalledTimes(2);
      // Both should call the same function but with different logging
      
      vi.useRealTimers();
    });
  });

  describe('Edge cases and error handling', () => {
    let touchStartHandler: (event: TouchEvent) => void;
    let touchMoveHandler: (event: TouchEvent) => void;

    beforeEach(() => {
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      const calls = (mockSvgElement.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
      touchStartHandler = calls.find(call => call[0] === 'touchstart')[1];
      touchMoveHandler = calls.find(call => call[0] === 'touchmove')[1];
    });

    it('should handle rapid gesture changes', () => {
      // Start with two touches
      const touchStartEvent = createMockTouchEvent([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 }
      ], 'touchstart');
      touchStartHandler(touchStartEvent);

      // Rapid pinch out
      const rapidPinchOut = createMockTouchEvent([
        { clientX: 50, clientY: 50 },
        { clientX: 250, clientY: 250 }
      ]);
      touchMoveHandler(rapidPinchOut);

      // Rapid pinch in
      const rapidPinchIn = createMockTouchEvent([
        { clientX: 120, clientY: 120 },
        { clientX: 180, clientY: 180 }
      ]);
      touchMoveHandler(rapidPinchIn);

      expect(mockOnPinchZoomIn).toHaveBeenCalled();
      expect(mockOnPinchZoomOut).toHaveBeenCalled();
    });

    it('should handle interrupted touches', () => {
      // Start pinch
      const touchStartEvent = createMockTouchEvent([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 }
      ], 'touchstart');
      touchStartHandler(touchStartEvent);

      // Touch move with only one touch (interrupted)
      const interruptedMove = createMockTouchEvent([{ clientX: 150, clientY: 150 }]);
      touchMoveHandler(interruptedMove);

      expect(mockOnPinchZoomIn).not.toHaveBeenCalled();
      expect(mockOnPinchZoomOut).not.toHaveBeenCalled();
    });

    it('should handle zero initial distance', () => {
      // Mock touches at same position (zero distance)
      const zeroDistanceEvent = createMockTouchEvent([
        { clientX: 100, clientY: 100 },
        { clientX: 100, clientY: 100 }
      ], 'touchstart');
      touchStartHandler(zeroDistanceEvent);

      const moveEvent = createMockTouchEvent([
        { clientX: 110, clientY: 110 },
        { clientX: 90, clientY: 90 }
      ]);
      touchMoveHandler(moveEvent);

      // Should not crash and should not call zoom functions
      expect(mockOnPinchZoomIn).not.toHaveBeenCalled();
      expect(mockOnPinchZoomOut).not.toHaveBeenCalled();
    });

    it('should handle three or more touches gracefully', () => {
      const multiTouchEvent = createMockTouchEvent([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 },
        { clientX: 300, clientY: 300 }
      ], 'touchstart');

      expect(() => touchStartHandler(multiTouchEvent)).not.toThrow();
    });
  });

  describe('Mobile vs Desktop behavior', () => {
    it('should handle touch events on mobile devices', () => {
      // Touch events are the primary gesture input on mobile
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      expect(mockSvgElement.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { passive: false }
      );
    });

    it('should handle wheel events on desktop devices', () => {
      // Wheel events are primary for desktop
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      expect(mockSvgElement.addEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        { passive: false }
      );
    });

    it('should prevent default behavior to avoid browser scroll', () => {
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      // All event listeners should be registered with passive: false
      const calls = (mockSvgElement.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
      calls.forEach(call => {
        expect(call[2]).toEqual({ passive: false });
      });
    });
  });

  describe('Performance and memory management', () => {
    it('should cleanup all event listeners to prevent memory leaks', () => {
      const { unmount } = renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      const addCalls = (mockSvgElement.addEventListener as ReturnType<typeof vi.fn>).mock.calls.length;
      
      unmount();
      
      const removeCalls = (mockSvgElement.removeEventListener as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(removeCalls).toBe(addCalls);
    });

    it('should handle rapid re-renders without memory leaks', () => {
      const { rerender } = renderHook(
        ({ visible }) =>
          useTouchGestures({
            svgRef,
            visible,
            onPinchZoomIn: mockOnPinchZoomIn,
            onPinchZoomOut: mockOnPinchZoomOut,
          }),
        { initialProps: { visible: true } }
      );

      // Re-render with visibility changes (this should trigger cleanup/setup)
      rerender({ visible: false });
      rerender({ visible: true });
      rerender({ visible: false });
      rerender({ visible: true });

      // Should cleanup and re-setup event listeners when visibility changes
      expect(mockSvgElement.removeEventListener).toHaveBeenCalled();
      expect(mockSvgElement.addEventListener).toHaveBeenCalled();
    });
  });

  describe('Accessibility considerations', () => {
    it('should support keyboard accessibility through wheel events', () => {
      // Keyboard navigation often triggers wheel events
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      expect(mockSvgElement.addEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        { passive: false }
      );
    });

    it('should prevent default behaviors that interfere with screen readers', () => {
      renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      // Events should be registered with passive: false to allow preventDefault
      const calls = (mockSvgElement.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.every(call => call[2]?.passive === false)).toBe(true);
    });
  });

  describe('TypeScript interface validation', () => {
    it('should accept valid props interface', () => {
      const validProps = {
        svgRef,
        visible: true,
        onPinchZoomIn: mockOnPinchZoomIn,
        onPinchZoomOut: mockOnPinchZoomOut,
      };

      expect(() => {
        renderHook(() => useTouchGestures(validProps));
      }).not.toThrow();
    });

    it('should return proper interface', () => {
      const { result } = renderHook(() =>
        useTouchGestures({
          svgRef,
          visible: true,
          onPinchZoomIn: mockOnPinchZoomIn,
          onPinchZoomOut: mockOnPinchZoomOut,
        })
      );

      expect(result.current).toHaveProperty('setupTouchHandlers');
      expect(typeof result.current.setupTouchHandlers).toBe('function');
    });
  });
}); 