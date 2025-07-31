import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ZoomControlsEnhanced from './zoom-controls-enhanced';

// Mock timer functions for testing continuous zoom
vi.useFakeTimers();

describe('ZoomControlsEnhanced', () => {
  const mockOnZoomIn = vi.fn();
  const mockOnZoomOut = vi.fn();
  const mockOnZoomReset = vi.fn();
  const mockOnClearAll = vi.fn();

  const defaultProps = {
    onZoomIn: mockOnZoomIn,
    onZoomOut: mockOnZoomOut,
    onZoomReset: mockOnZoomReset,
    onClearAll: mockOnClearAll
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('Basic Rendering', () => {
    it('should render all zoom control buttons by default', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      expect(screen.getByTestId('zoom-in-button')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out-button')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-reset-button')).toBeInTheDocument();
      expect(screen.getByTestId('clear-all-button')).toBeInTheDocument();
    });

    it('should render with correct accessibility attributes', () => {
      render(<ZoomControlsEnhanced {...defaultProps} ariaLabel="Custom zoom controls" />);
      
      const container = screen.getByRole('toolbar');
      expect(container).toHaveAttribute('aria-label', 'Custom zoom controls');
      expect(container).toHaveAttribute('role', 'toolbar');
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      expect(zoomInButton).toHaveAttribute('aria-label', 'Zoom in (keyboard shortcut: +)');
      expect(zoomInButton).toHaveAttribute('aria-keyshortcuts', '+');
      
      const zoomOutButton = screen.getByTestId('zoom-out-button');
      expect(zoomOutButton).toHaveAttribute('aria-label', 'Zoom out (keyboard shortcut: -)');
      expect(zoomOutButton).toHaveAttribute('aria-keyshortcuts', '-');
      
      const resetButton = screen.getByTestId('zoom-reset-button');
      expect(resetButton).toHaveAttribute('aria-label', 'Reset zoom to default (keyboard shortcut: 0)');
      expect(resetButton).toHaveAttribute('aria-keyshortcuts', '0');
      
      const clearButton = screen.getByTestId('clear-all-button');
      expect(clearButton).toHaveAttribute('aria-label', 'Clear all data (keyboard shortcut: Escape)');
      expect(clearButton).toHaveAttribute('aria-keyshortcuts', 'Escape');
    });

    it('should hide clear button when showClearButton is false', () => {
      render(<ZoomControlsEnhanced {...defaultProps} showClearButton={false} />);
      
      expect(screen.queryByTestId('clear-all-button')).not.toBeInTheDocument();
    });

    it('should not render clear button when onClearAll is not provided', () => {
      const { onClearAll, ...propsWithoutClear } = defaultProps;
      render(<ZoomControlsEnhanced {...propsWithoutClear} />);
      
      expect(screen.queryByTestId('clear-all-button')).not.toBeInTheDocument();
    });
  });

  describe('Button Interactions', () => {
    it('should call onZoomIn when zoom in button is clicked', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      fireEvent.click(zoomInButton);
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
    });

    it('should call onZoomOut when zoom out button is clicked', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const zoomOutButton = screen.getByTestId('zoom-out-button');
      fireEvent.click(zoomOutButton);
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomOut).toHaveBeenCalledTimes(1);
    });

    it('should call onZoomReset when reset button is clicked', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const resetButton = screen.getByTestId('zoom-reset-button');
      fireEvent.click(resetButton);
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomReset).toHaveBeenCalledTimes(1);
    });

    it('should call onClearAll when clear button is clicked', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const clearButton = screen.getByTestId('clear-all-button');
      fireEvent.click(clearButton);
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnClearAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Continuous Zoom Functionality', () => {
    it('should perform continuous zoom when holding down zoom in button', () => {
      render(<ZoomControlsEnhanced {...defaultProps} continuousZoomInterval={100} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      
      // Mouse down to start continuous zoom
      fireEvent.mouseDown(zoomInButton);
      
      // Should be called immediately
      expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
      
      // Advance timers to trigger continuous zoom
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(mockOnZoomIn).toHaveBeenCalledTimes(2);
      
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(mockOnZoomIn).toHaveBeenCalledTimes(3);
      
      // Mouse up to stop continuous zoom
      fireEvent.mouseUp(zoomInButton);
      
      // No more calls after mouse up
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(mockOnZoomIn).toHaveBeenCalledTimes(3);
    });

    it('should perform continuous zoom when holding down zoom out button', () => {
      render(<ZoomControlsEnhanced {...defaultProps} continuousZoomInterval={100} />);
      
      const zoomOutButton = screen.getByTestId('zoom-out-button');
      
      fireEvent.mouseDown(zoomOutButton);
      expect(mockOnZoomOut).toHaveBeenCalledTimes(1);
      
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(mockOnZoomOut).toHaveBeenCalledTimes(3);
      
      fireEvent.mouseUp(zoomOutButton);
    });

    it('should stop continuous zoom when mouse leaves button', () => {
      render(<ZoomControlsEnhanced {...defaultProps} continuousZoomInterval={100} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      
      fireEvent.mouseDown(zoomInButton);
      expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
      
      fireEvent.mouseLeave(zoomInButton);
      
      act(() => {
        vi.advanceTimersByTime(100);
      });
      // Should not continue zooming after mouse leave
      expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Touch Interactions', () => {
    it('should handle touch events for zoom in button', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      
      fireEvent(zoomInButton, touchStartEvent);
      expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
      
      const touchEndEvent = new TouchEvent('touchend', { touches: [] });
      fireEvent(zoomInButton, touchEndEvent);
      act(() => { vi.runAllTimers(); });
    });

    it('should handle touch events for zoom out button', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const zoomOutButton = screen.getByTestId('zoom-out-button');
      
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      
      fireEvent(zoomOutButton, touchStartEvent);
      expect(mockOnZoomOut).toHaveBeenCalledTimes(1);
      act(() => { vi.runAllTimers(); });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should trigger zoom in with + key', () => {
      render(<ZoomControlsEnhanced {...defaultProps} enableKeyboardShortcuts={true} />);
      
      fireEvent.keyDown(document, { key: '+' });
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
    });

    it('should trigger zoom out with - key', () => {
      render(<ZoomControlsEnhanced {...defaultProps} enableKeyboardShortcuts={true} />);
      
      fireEvent.keyDown(document, { key: '-' });
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomOut).toHaveBeenCalledTimes(1);
    });

    it('should trigger zoom reset with 0 key', () => {
      render(<ZoomControlsEnhanced {...defaultProps} enableKeyboardShortcuts={true} />);
      
      fireEvent.keyDown(document, { key: '0' });
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomReset).toHaveBeenCalledTimes(1);
    });

    it('should trigger clear all with Escape key', () => {
      render(<ZoomControlsEnhanced {...defaultProps} enableKeyboardShortcuts={true} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnClearAll).toHaveBeenCalledTimes(1);
    });

    it('should use custom keyboard shortcuts when provided', () => {
      const customShortcuts = {
        zoomIn: 'i',
        zoomOut: 'o',
        zoomReset: 'r',
        clearAll: 'c'
      };
      
      render(
        <ZoomControlsEnhanced 
          {...defaultProps} 
          enableKeyboardShortcuts={true}
          keyboardShortcuts={customShortcuts}
        />
      );
      
      fireEvent.keyDown(document, { key: 'i' });
      act(() => { vi.runAllTimers(); });
      expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
      
      fireEvent.keyDown(document, { key: 'o' });
      act(() => { vi.runAllTimers(); });
      expect(mockOnZoomOut).toHaveBeenCalledTimes(1);
      
      fireEvent.keyDown(document, { key: 'r' });
      act(() => { vi.runAllTimers(); });
      expect(mockOnZoomReset).toHaveBeenCalledTimes(1);
      
      fireEvent.keyDown(document, { key: 'c' });
      act(() => { vi.runAllTimers(); });
      expect(mockOnClearAll).toHaveBeenCalledTimes(1);
    });

    it('should not trigger shortcuts when keyboard shortcuts are disabled', () => {
      render(<ZoomControlsEnhanced {...defaultProps} enableKeyboardShortcuts={false} />);
      
      fireEvent.keyDown(document, { key: '+' });
      fireEvent.keyDown(document, { key: '-' });
      fireEvent.keyDown(document, { key: '0' });
      fireEvent.keyDown(document, { key: 'Escape' });
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomIn).not.toHaveBeenCalled();
      expect(mockOnZoomOut).not.toHaveBeenCalled();
      expect(mockOnZoomReset).not.toHaveBeenCalled();
      expect(mockOnClearAll).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable all buttons when disabled prop is true', () => {
      render(<ZoomControlsEnhanced {...defaultProps} disabled={true} />);
      
      expect(screen.getByTestId('zoom-in-button')).toBeDisabled();
      expect(screen.getByTestId('zoom-out-button')).toBeDisabled();
      expect(screen.getByTestId('zoom-reset-button')).toBeDisabled();
      expect(screen.getByTestId('clear-all-button')).toBeDisabled();
    });

    it('should not respond to clicks when disabled', () => {
      render(<ZoomControlsEnhanced {...defaultProps} disabled={true} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      fireEvent.click(zoomInButton);
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomIn).not.toHaveBeenCalled();
    });

    it('should not respond to keyboard shortcuts when disabled', () => {
      render(<ZoomControlsEnhanced {...defaultProps} disabled={true} enableKeyboardShortcuts={true} />);
      
      fireEvent.keyDown(document, { key: '+' });
      fireEvent.keyDown(document, { key: '-' });
      fireEvent.keyDown(document, { key: '0' });
      fireEvent.keyDown(document, { key: 'Escape' });
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomIn).not.toHaveBeenCalled();
      expect(mockOnZoomOut).not.toHaveBeenCalled();
      expect(mockOnZoomReset).not.toHaveBeenCalled();
      expect(mockOnClearAll).not.toHaveBeenCalled();
    });

    it('should have proper aria-disabled attribute when disabled', () => {
      render(<ZoomControlsEnhanced {...defaultProps} disabled={true} />);
      
      const container = screen.getByRole('toolbar');
      expect(container).toHaveAttribute('aria-disabled', 'true');
      expect(container).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Positioning and Layout', () => {
    it('should apply correct position classes', () => {
      const { rerender } = render(<ZoomControlsEnhanced {...defaultProps} position="top-left" />);
      let container = screen.getByRole('toolbar');
      expect(container).toHaveClass('top-16', 'sm:top-20', 'left-2', 'sm:left-6');
      
      rerender(<ZoomControlsEnhanced {...defaultProps} position="bottom-right" />);
      container = screen.getByRole('toolbar');
      expect(container).toHaveClass('bottom-16', 'sm:bottom-20', 'right-2', 'sm:right-6');
    });

    it('should apply correct orientation classes', () => {
      const { rerender } = render(<ZoomControlsEnhanced {...defaultProps} orientation="vertical" />);
      let container = screen.getByRole('toolbar');
      expect(container).toHaveClass('flex-col');
      
      rerender(<ZoomControlsEnhanced {...defaultProps} orientation="horizontal" />);
      container = screen.getByRole('toolbar');
      expect(container).toHaveClass('flex-row');
    });

    it('should apply custom CSS classes', () => {
      render(
        <ZoomControlsEnhanced 
          {...defaultProps} 
          className="custom-container"
          buttonClassName="custom-button"
          containerClassName="custom-wrapper"
        />
      );
      
      const container = screen.getByRole('toolbar');
      expect(container).toHaveClass('custom-container', 'custom-wrapper');
      
      const button = screen.getByTestId('zoom-in-button');
      expect(button).toHaveClass('custom-button');
    });
  });

  describe('Theme Support', () => {
    it('should apply dark theme classes by default', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const button = screen.getByTestId('zoom-in-button');
      expect(button).toHaveClass('bg-gray-900/90', 'hover:bg-gray-800', 'border-gray-700');
    });

    it('should apply light theme classes when specified', () => {
      render(<ZoomControlsEnhanced {...defaultProps} theme="light" />);
      
      const button = screen.getByTestId('zoom-in-button');
      expect(button).toHaveClass('bg-white/90', 'hover:bg-gray-100', 'border-gray-300');
    });

    it('should apply auto theme classes when specified', () => {
      render(<ZoomControlsEnhanced {...defaultProps} theme="auto" />);
      
      const button = screen.getByTestId('zoom-in-button');
      expect(button).toHaveClass('bg-gray-900/90', 'dark:bg-gray-100/90');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus state correctly', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      
      fireEvent.focus(zoomInButton);
      
      expect(zoomInButton).toHaveFocus();
    });

    it('should handle keyboard navigation within container', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const container = screen.getByRole('toolbar');
      
      fireEvent.keyDown(container, { key: 'ArrowDown' });
      fireEvent.keyDown(container, { key: 'ArrowRight' });
      fireEvent.keyDown(container, { key: 'ArrowUp' });
      fireEvent.keyDown(container, { key: 'ArrowLeft' });
      fireEvent.keyDown(container, { key: 'Enter' });
      fireEvent.keyDown(container, { key: ' ' });
      
      // Should not throw errors and handle navigation
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid button clicks without errors', async () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      
      // Rapid clicks
      for (let i = 0; i < 10; i++) {
        fireEvent.click(zoomInButton);
      }
      act(() => { vi.runAllTimers(); });
      
      expect(mockOnZoomIn).toHaveBeenCalledTimes(10);
    });

    it('should handle debounced actions correctly', () => {
      render(<ZoomControlsEnhanced {...defaultProps} debounceMs={100} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      
      // Multiple rapid clicks
      fireEvent.mouseDown(zoomInButton);
      fireEvent.mouseUp(zoomInButton);
      fireEvent.mouseDown(zoomInButton);
      fireEvent.mouseUp(zoomInButton);
      act(() => { vi.runAllTimers(); });
      
      // Should only call once due to debouncing
      expect(mockOnZoomIn).toHaveBeenCalledTimes(1);
      
      // Advance timers to trigger debounced action
      act(() => {
        vi.advanceTimersByTime(100);
      });
      
      expect(mockOnZoomIn).toHaveBeenCalledTimes(2);
    });

    it('should cleanup timers on unmount', () => {
      const { unmount } = render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      fireEvent.mouseDown(zoomInButton);
      
      // Unmount before mouse up
      unmount();
      
      // Should not continue zooming after unmount
      act(() => {
        vi.advanceTimersByTime(100);
      });
    });

    it('should handle error in zoom functions gracefully', () => {
      const errorOnZoomIn = vi.fn(() => {
        throw new Error('Zoom error');
      });
      
      // Should not throw error to component level
      expect(() => {
        render(<ZoomControlsEnhanced {...defaultProps} onZoomIn={errorOnZoomIn} />);
        
        const zoomInButton = screen.getByTestId('zoom-in-button');
        fireEvent.mouseDown(zoomInButton);
      }).not.toThrow();
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have proper ARIA attributes for screen readers', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const container = screen.getByRole('toolbar');
      expect(container).toHaveAttribute('role', 'toolbar');
      expect(container).toHaveAttribute('aria-label');
      
      // All icons should be hidden from screen readers
      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons).toHaveLength(4); // Plus, Minus, RotateCcw, X icons
    });

    it('should have proper tabindex management', () => {
      render(<ZoomControlsEnhanced {...defaultProps} />);
      
      const container = screen.getByRole('toolbar');
      expect(container).toHaveAttribute('tabIndex', '0');
      
      // When disabled
      const { rerender } = render(<ZoomControlsEnhanced {...defaultProps} disabled={true} />);
      const disabledContainer = screen.getByRole('toolbar');
      expect(disabledContainer).toHaveAttribute('tabIndex', '-1');
    });

    it('should support custom aria labels', () => {
      render(<ZoomControlsEnhanced {...defaultProps} ariaLabel="Custom zoom toolbar" />);
      
      const container = screen.getByRole('toolbar');
      expect(container).toHaveAttribute('aria-label', 'Custom zoom toolbar');
    });
  });

  describe('TypeScript Interface Validation', () => {
    it('should accept all valid prop combinations', () => {
      // Test that TypeScript interface allows various prop combinations
      const validProps = {
        ...defaultProps,
        position: 'bottom-left' as const,
        orientation: 'horizontal' as const,
        showClearButton: false,
        disabled: true,
        className: 'test-class',
        buttonClassName: 'test-button',
        containerClassName: 'test-container',
        theme: 'light' as const,
        ariaLabel: 'Test toolbar',
        enableKeyboardShortcuts: true,
        keyboardShortcuts: {
          zoomIn: 'a',
          zoomOut: 'b',
          zoomReset: 'c',
          clearAll: 'd'
        },
        continuousZoomInterval: 50,
        debounceMs: 200
      };
      
      expect(() => {
        render(<ZoomControlsEnhanced {...validProps} />);
      }).not.toThrow();
    });
  });
});