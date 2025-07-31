import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { NetworkNode } from '@/types/network';
import { cn } from '@/lib/utils';

export interface NetworkResetButtonProps {
  /** Whether the button should be visible (expanded mode) */
  visible: boolean;
  /** The main artist node to display in the button text */
  mainArtistNode?: NetworkNode;
  /** Callback function to reset the network to first-degree view */
  onReset: () => void;
  /** Optional custom className for styling */
  className?: string;
  /** Optional custom button text */
  buttonText?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether to show loading state */
  loading?: boolean;
  /** Button size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Button variant */
  variant?: 'default' | 'secondary' | 'outline';
  /** Optional test ID for testing */
  'data-testid'?: string;
}

/**
 * Network Reset Button Component
 * 
 * A reusable button component for resetting network visualization to first-degree view.
 * Displays a back arrow and the main artist name, with proper accessibility features.
 */
export function NetworkResetButton({
  visible,
  mainArtistNode,
  onReset,
  className,
  buttonText,
  disabled = false,
  loading = false,
  size = 'default',
  variant = 'default',
  'data-testid': testId = 'network-reset-button',
}: NetworkResetButtonProps) {
  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // Generate button text
  const displayText = buttonText || `← Back to ${mainArtistNode?.name || 'Main Artist'}`;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!disabled && !loading) {
      onReset();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled && !loading) {
        onReset();
      }
    }
  };

  return (
    <Button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || loading}
      size={size}
      variant={variant}
      className={cn(
        'absolute top-4 right-4 shadow-lg transition-all duration-200 z-10',
        'hover:shadow-xl focus:shadow-xl',
        'min-w-[120px] justify-start',
        className
      )}
      data-testid={testId}
      aria-label={`Reset network view to ${mainArtistNode?.name || 'main artist'}`}
      title={`Click to return to ${mainArtistNode?.name || 'main artist'} network view`}
    >
      <ArrowLeft 
        className="h-4 w-4 shrink-0" 
        aria-hidden="true"
      />
      <span className="truncate">
        {loading ? 'Resetting...' : displayText}
      </span>
    </Button>
  );
}

export default NetworkResetButton; 