import React, { useState, useRef, useCallback, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoomControlsEnhancedProps {
  // Core zoom functions
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onBackToFirstDegree?: () => void;
  onClearAll?: () => void;
  
  // Configuration options
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  orientation?: 'vertical' | 'horizontal';
  showClearButton?: boolean;
  showBackToFirstDegree?: boolean;
  disabled?: boolean;
  
  // Styling customization
  className?: string;
  buttonClassName?: string;
  containerClassName?: string;
  theme?: 'dark' | 'light' | 'auto';
  
  // Accessibility
  ariaLabel?: string;
  
  // Keyboard shortcuts
  enableKeyboardShortcuts?: boolean;
  keyboardShortcuts?: {
    zoomIn?: string;
    zoomOut?: string;
    zoomReset?: string;
    backToFirstDegree?: string;
    clearAll?: string;
  };
  
  // Performance
  continuousZoomInterval?: number;
  debounceMs?: number;
}

const defaultKeyboardShortcuts = {
  zoomIn: '+',
  zoomOut: '-',
  zoomReset: '0',
  backToFirstDegree: 'b',
  clearAll: 'Escape'
};

const positionClasses = {
  'top-left': 'top-16 sm:top-20 left-2 sm:left-6',
  'top-right': 'top-16 sm:top-20 right-2 sm:right-6',
  'bottom-left': 'bottom-16 sm:bottom-20 left-2 sm:left-6',
  'bottom-right': 'bottom-16 sm:bottom-20 right-2 sm:right-6'
};

const orientationClasses = {
  vertical: 'flex-col',
  horizontal: 'flex-row'
};

const themeClasses = {
  dark: 'bg-gray-900/90 hover:bg-gray-800 border-gray-700',
  light: 'bg-white/90 hover:bg-gray-100 border-gray-300',
  auto: 'bg-gray-900/90 hover:bg-gray-800 border-gray-700 dark:bg-gray-100/90 dark:hover:bg-gray-200 dark:border-gray-300'
};

export const ZoomControlsEnhanced = memo<ZoomControlsEnhancedProps>(({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onBackToFirstDegree,
  onClearAll,
  position = 'top-right',
  orientation = 'vertical',
  showClearButton = true,
  showBackToFirstDegree = false,
  disabled = false,
  className,
  buttonClassName,
  containerClassName,
  theme = 'dark',
  ariaLabel = 'Zoom controls',
  enableKeyboardShortcuts = true,
  keyboardShortcuts = defaultKeyboardShortcuts,
  continuousZoomInterval = 100,
  debounceMs = 0
}) => {
  const [isZooming, setIsZooming] = useState(false);
  const [focusedButton, setFocusedButton] = useState<string | null>(null);
  const zoomIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMouseDownRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced action handler
  const handleDebouncedAction = useCallback((action: () => void) => {
    if (debounceMs > 0) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(action, debounceMs);
    } else {
      action();
    }
  }, [debounceMs]);

  // Continuous zoom functionality
  const startContinuousZoom = useCallback((zoomFunction: () => void) => {
    if (zoomIntervalRef.current || disabled) return;
    
    // First zoom immediately
    zoomFunction();
    
    // Then start continuous zooming
    zoomIntervalRef.current = setInterval(() => {
      if (isMouseDownRef.current && !disabled) {
        zoomFunction();
      }
    }, continuousZoomInterval);
  }, [continuousZoomInterval, disabled]);

  const stopContinuousZoom = useCallback(() => {
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
    isMouseDownRef.current = false;
    setIsZooming(false);
  }, []);

  // Enhanced zoom handlers
  const handleZoomInStart = useCallback(() => {
    if (disabled) return;
    isMouseDownRef.current = true;
    setIsZooming(true);
    handleDebouncedAction(() => startContinuousZoom(onZoomIn));
  }, [onZoomIn, startContinuousZoom, handleDebouncedAction, disabled]);

  const handleZoomOutStart = useCallback(() => {
    if (disabled) return;
    isMouseDownRef.current = true;
    setIsZooming(true);
    handleDebouncedAction(() => startContinuousZoom(onZoomOut));
  }, [onZoomOut, startContinuousZoom, handleDebouncedAction, disabled]);

  const handleZoomReset = useCallback(() => {
    if (disabled) return;
    setIsZooming(true);
    handleDebouncedAction(() => {
      onZoomReset();
      setTimeout(() => setIsZooming(false), 500);
    });
  }, [onZoomReset, handleDebouncedAction, disabled]);

  const handleClearAll = useCallback(() => {
    if (disabled || !onClearAll) return;
    handleDebouncedAction(onClearAll);
  }, [onClearAll, handleDebouncedAction, disabled]);

  const handleBackToFirstDegree = useCallback(() => {
    if (disabled || !onBackToFirstDegree) return;
    handleDebouncedAction(onBackToFirstDegree);
  }, [onBackToFirstDegree, handleDebouncedAction, disabled]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled || !enableKeyboardShortcuts) return;

    // Don't capture shortcuts when user is typing in input fields
    // This allows normal typing in search bars, text inputs, etc.
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.contentEditable === 'true' ||
                        target.closest('input, textarea, [contenteditable]') ||
                        target.closest('[role="textbox"]') ||
                        target.closest('[data-input]');
    
    if (isInputField) {
      // Allow normal typing in input fields
      console.log('🔤 [Zoom Controls] Allowing key in input field:', event.key, 'Target:', target.tagName);
      return;
    }

    const key = event.key;
    const shortcuts = { ...defaultKeyboardShortcuts, ...keyboardShortcuts };

    // Only prevent default for our shortcuts when not in input fields
    const isOurShortcut = Object.values(shortcuts).includes(key);
    if (isOurShortcut) {
      console.log('⌨️ [Zoom Controls] Capturing shortcut key:', key);
      event.preventDefault();
      event.stopPropagation();
    }

    switch (key) {
      case shortcuts.zoomIn:
        handleZoomInStart();
        setTimeout(stopContinuousZoom, 100); // Single action for keyboard
        break;
      case shortcuts.zoomOut:
        handleZoomOutStart();
        setTimeout(stopContinuousZoom, 100); // Single action for keyboard
        break;
      case shortcuts.zoomReset:
        handleZoomReset();
        break;
      case shortcuts.backToFirstDegree:
        if (onBackToFirstDegree) {
          handleBackToFirstDegree();
        }
        break;
      case shortcuts.clearAll:
        if (onClearAll) {
          handleClearAll();
        }
        break;
    }
  }, [
    disabled,
    enableKeyboardShortcuts,
    keyboardShortcuts,
    handleZoomInStart,
    handleZoomOutStart,
    handleZoomReset,
    handleBackToFirstDegree,
    handleClearAll,
    stopContinuousZoom,
    onBackToFirstDegree,
    onClearAll
  ]);

  // Keyboard focus management
  const handleContainerKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        // Move to next button
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        // Move to previous button
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        // Activate focused button
        break;
    }
  }, [disabled]);

  // Setup global keyboard shortcuts
  useEffect(() => {
    if (enableKeyboardShortcuts && !disabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, enableKeyboardShortcuts, disabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopContinuousZoom();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [stopContinuousZoom]);

  // Touch event handlers for better mobile support
  const handleTouchStart = useCallback((handler: () => void) => (event: React.TouchEvent) => {
    event.preventDefault();
    handler();
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    stopContinuousZoom();
  }, [stopContinuousZoom]);

  // Build CSS classes
  const containerClass = cn(
    'fixed flex gap-1 sm:gap-2 opacity-100 transition-opacity duration-500 z-30 border-2 rounded-xl p-2',
    positionClasses[position],
    orientationClasses[orientation],
    containerClassName,
    className
  );

  const buttonClass = cn(
    'w-10 h-10 sm:w-12 sm:h-12 backdrop-blur border disabled:opacity-50 transition-all duration-200',
    themeClasses[theme],
    buttonClassName
  );

  const buttonProps = {
    size: "icon" as const,
    variant: "secondary" as const,
    disabled: disabled || isZooming,
    className: buttonClass
  };

  return (
    <div
      ref={containerRef}
      className={containerClass}
      style={{ borderColor: '#b427b4' }}
      role="toolbar"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onKeyDown={handleContainerKeyDown}
      tabIndex={disabled ? -1 : 0}
    >
      {/* Zoom In Button */}
      <Button
        {...buttonProps}
        onClick={onZoomIn} // <-- direct click handler
        onMouseDown={handleZoomInStart}
        onMouseUp={stopContinuousZoom}
        onMouseLeave={stopContinuousZoom}
        onTouchStart={handleTouchStart(handleZoomInStart)}
        onTouchEnd={handleTouchEnd}
        aria-label="Zoom in (keyboard shortcut: +)"
        aria-keyshortcuts={enableKeyboardShortcuts ? keyboardShortcuts.zoomIn || '+' : undefined}
        title={`Zoom In${enableKeyboardShortcuts ? ` (${keyboardShortcuts.zoomIn || '+'})` : ''} - Hold to continuous zoom`}
        onFocus={() => setFocusedButton('zoom-in')}
        onBlur={() => setFocusedButton(null)}
        data-testid="zoom-in-button"
      >
        <Plus className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
      </Button>

      {/* Zoom Out Button */}
      <Button
        {...buttonProps}
        onClick={onZoomOut} // <-- direct click handler
        onMouseDown={handleZoomOutStart}
        onMouseUp={stopContinuousZoom}
        onMouseLeave={stopContinuousZoom}
        onTouchStart={handleTouchStart(handleZoomOutStart)}
        onTouchEnd={handleTouchEnd}
        aria-label="Zoom out (keyboard shortcut: -)"
        aria-keyshortcuts={enableKeyboardShortcuts ? keyboardShortcuts.zoomOut || '-' : undefined}
        title={`Zoom Out${enableKeyboardShortcuts ? ` (${keyboardShortcuts.zoomOut || '-'})` : ''} - Hold to continuous zoom`}
        onFocus={() => setFocusedButton('zoom-out')}
        onBlur={() => setFocusedButton(null)}
        data-testid="zoom-out-button"
      >
        <Minus className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
      </Button>

      {/* Zoom Reset Button */}
      <Button
        {...buttonProps}
        onClick={handleZoomReset}
        aria-label="Reset zoom to default (keyboard shortcut: 0)"
        aria-keyshortcuts={enableKeyboardShortcuts ? keyboardShortcuts.zoomReset || '0' : undefined}
        title={`Reset Zoom${enableKeyboardShortcuts ? ` (${keyboardShortcuts.zoomReset || '0'})` : ''}`}
        onFocus={() => setFocusedButton('zoom-reset')}
        onBlur={() => setFocusedButton(null)}
        data-testid="zoom-reset-button"
      >
        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
      </Button>

      {/* Back to First Degree Button */}
      {showBackToFirstDegree && onBackToFirstDegree && (
        <Button
          {...buttonProps}
          onClick={handleBackToFirstDegree}
          variant="secondary"
          style={{ 
            backgroundColor: '#F2A6E0', 
            borderColor: '#F2A6E0',
            '--tw-hover-bg-opacity': '1'
          } as React.CSSProperties}
          className={cn(buttonClass, 'hover:bg-[#EB93D5]')}
          aria-label="Back to first degree network (keyboard shortcut: b)"
          aria-keyshortcuts={enableKeyboardShortcuts ? keyboardShortcuts.backToFirstDegree || 'b' : undefined}
          title={`Back to First Degree${enableKeyboardShortcuts ? ` (${keyboardShortcuts.backToFirstDegree || 'b'})` : ''}`}
          onFocus={() => setFocusedButton('back-to-first-degree')}
          onBlur={() => setFocusedButton(null)}
          data-testid="back-to-first-degree-button"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="#282A36" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Button>
      )}

      {/* Separator */}
      {(showClearButton && onClearAll) || (showBackToFirstDegree && onBackToFirstDegree) ? (
        <div className="w-full h-px bg-gray-700 my-1" role="separator" />
      ) : null}

      {/* Clear All Button */}
      {showClearButton && onClearAll && (
        <Button
          {...buttonProps}
          onClick={handleClearAll}
          variant="destructive"
          className={cn(buttonClass, 'bg-red-900/90 hover:bg-red-800 border-red-700')}
          aria-label="Clear all data (keyboard shortcut: Escape)"
          aria-keyshortcuts={enableKeyboardShortcuts ? keyboardShortcuts.clearAll || 'Escape' : undefined}
          title={`Clear All${enableKeyboardShortcuts ? ` (${keyboardShortcuts.clearAll || 'Escape'})` : ''}`}
          onFocus={() => setFocusedButton('clear-all')}
          onBlur={() => setFocusedButton(null)}
          data-testid="clear-all-button"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
});

ZoomControlsEnhanced.displayName = 'ZoomControlsEnhanced';

export default ZoomControlsEnhanced;