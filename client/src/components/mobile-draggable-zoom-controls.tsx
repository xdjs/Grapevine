import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, RotateCcw, X, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDraggableZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onBackToFirstDegree?: () => void;
  onClearAll?: () => void;
  showClearButton?: boolean;
  showBackToFirstDegree?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function MobileDraggableZoomControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onBackToFirstDegree,
  onClearAll,
  showClearButton = true,
  showBackToFirstDegree = false,
  disabled = false,
  className
}: MobileDraggableZoomControlsProps) {
  const [position, setPosition] = useState(() => {
    // Try to load saved position from localStorage
    try {
      const saved = localStorage.getItem('mobile-zoom-controls-position');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { x: parsed.x || 20, y: parsed.y || 100 };
      }
    } catch (error) {
      console.warn('Failed to load saved position:', error);
    }
    return { x: 20, y: 100 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to load saved collapsed state from localStorage
    try {
      const saved = localStorage.getItem('mobile-zoom-controls-collapsed');
      return saved === 'true';
    } catch (error) {
      console.warn('Failed to load saved collapsed state:', error);
      return false;
    }
  });
  
  const lastTapRef = useRef(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Touch event handlers for dragging
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.target === dragHandleRef.current || dragHandleRef.current?.contains(e.target as Node)) {
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        });
        setIsDragging(true);
      }
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && containerRef.current) {
      const touch = e.touches[0];
      const newX = touch.clientX - dragOffset.x;
      const newY = touch.clientY - dragOffset.y;
      
      // Constrain to screen bounds
      const maxX = window.innerWidth - (containerRef.current.offsetWidth || 200);
      const maxY = window.innerHeight - (containerRef.current.offsetHeight || 300);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  }, [isDragging, dragOffset]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse event handlers for dragging (for testing on desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === dragHandleRef.current || dragHandleRef.current?.contains(e.target as Node)) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
        setIsDragging(true);
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && containerRef.current) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Constrain to screen bounds
      const maxX = window.innerWidth - (containerRef.current.offsetWidth || 200);
      const maxY = window.innerHeight - (containerRef.current.offsetHeight || 300);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Prevent text selection while dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);

  // Save position and collapsed state to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('mobile-zoom-controls-position', JSON.stringify(position));
    } catch (error) {
      console.warn('Failed to save position:', error);
    }
  }, [position]);

  useEffect(() => {
    try {
      localStorage.setItem('mobile-zoom-controls-collapsed', isCollapsed.toString());
    } catch (error) {
      console.warn('Failed to save collapsed state:', error);
    }
  }, [isCollapsed]);

  // Reset position when screen orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      // Reset to a safe position when orientation changes
      setPosition({ x: 20, y: 100 });
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed z-50 select-none',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: isDragging ? 'scale(1.05)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s ease'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {/* Drag Handle */}
      <div
        ref={dragHandleRef}
        className="flex items-center justify-between w-full h-8 bg-gray-800/90 backdrop-blur border-2 border-gray-600 rounded-t-lg cursor-grab active:cursor-grabbing px-3"
        style={{ borderColor: '#b427b4' }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setPosition({ x: 20, y: 100 });
        }}
        onTouchEnd={(e) => {
          const now = Date.now();
          const DOUBLE_TAP_DELAY = 300;
          
          if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Double tap detected
            e.preventDefault();
            setPosition({ x: 20, y: 100 });
          }
          lastTapRef.current = now;
        }}
      >
        <div className="flex items-center">
          <Move className="w-4 h-4 text-gray-300" />
          <span className="ml-2 text-xs text-gray-300 font-medium">Drag to move</span>
          <span className="ml-1 text-xs text-gray-400">(double-tap to reset)</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          className="text-gray-300 hover:text-white transition-colors"
          title={isCollapsed ? "Expand controls" : "Collapse controls"}
        >
          {isCollapsed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Zoom Controls Container */}
      {!isCollapsed && (
        <div className="bg-gray-900/95 backdrop-blur border-2 border-gray-700 rounded-b-lg p-3 shadow-lg">
          {/* Zoom Controls */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-white mb-2">Zoom</h3>
              <div className="flex gap-2">
                <Button
                  onClick={onZoomIn}
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600 text-xs px-2 py-1 h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  In
                </Button>
                <Button
                  onClick={onZoomOut}
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600 text-xs px-2 py-1 h-8"
                >
                  <Minus className="w-3 h-3 mr-1" />
                  Out
                </Button>
                <Button
                  onClick={onZoomReset}
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border-gray-600 text-xs px-2 py-1 h-8"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
              </Button>
            </div>
          </div>

          {/* Back to First Degree Button */}
          {showBackToFirstDegree && onBackToFirstDegree && (
            <Button
              onClick={onBackToFirstDegree}
              size="sm"
              variant="secondary"
              disabled={disabled}
              className="w-full bg-[#F2A6E0] hover:bg-[#EB93D5] border-[#F2A6E0] text-xs px-2 py-1 h-8 text-[#282A36]"
            >
              <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to First Degree
            </Button>
          )}

          {/* Clear All Button */}
          {showClearButton && onClearAll && (
            <Button
              onClick={onClearAll}
              size="sm"
              variant="destructive"
              disabled={disabled}
              className="w-full bg-red-900/90 hover:bg-red-800 border-red-700 text-xs px-2 py-1 h-8"
            >
              <X className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
