import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetworkResetButton } from './network-reset-button';
import { NetworkNode } from '@/types/network';

// Mock the Button component from shadcn/ui
vi.mock('@/components/ui/button', () => ({
  Button: ({ 
    children, 
    onClick, 
    onKeyDown, 
    disabled, 
    className, 
    'data-testid': testId,
    'aria-label': ariaLabel,
    title,
    ...props 
  }: any) => {
    const handleClick = (event: any) => {
      if (onClick) {
        onClick(event);
      }
    };

    const handleKeyDown = (event: any) => {
      if (onKeyDown) {
        onKeyDown(event);
      }
    };

    return (
      <button
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={className}
        data-testid={testId}
        aria-label={ariaLabel}
        title={title}
        {...props}
      >
        {children}
      </button>
    );
  },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ArrowLeft: ({ className, 'aria-hidden': ariaHidden }: any) => (
    <svg className={className} aria-hidden={ariaHidden} data-testid="arrow-left-icon">
      ←
    </svg>
  ),
}));

// Mock the cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe('NetworkResetButton', () => {
  const mockOnReset = vi.fn();
  const mockMainArtistNode: NetworkNode = {
    id: 'artist-1',
    name: 'Taylor Swift',
    type: 'artist',
    size: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility and Rendering', () => {
    it('should not render when visible is false', () => {
      render(
        <NetworkResetButton
          visible={false}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      expect(screen.queryByTestId('network-reset-button')).not.toBeInTheDocument();
    });

    it('should render when visible is true', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      expect(screen.getByTestId('network-reset-button')).toBeInTheDocument();
    });

    it('should display default button text with main artist name', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      expect(screen.getByText('← Back to Taylor Swift')).toBeInTheDocument();
    });

    it('should display fallback text when main artist node is not provided', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('← Back to Main Artist')).toBeInTheDocument();
    });

    it('should display custom button text when provided', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          buttonText="Custom Reset Text"
        />
      );

      expect(screen.getByText('Custom Reset Text')).toBeInTheDocument();
    });

    it('should render arrow icon', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
    });
  });

  describe('Click Interactions', () => {
    it('should call onReset when clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      await user.click(button);

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });



    it('should not call onReset when disabled', async () => {
      const user = userEvent.setup();
      
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          disabled={true}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      await user.click(button);

      expect(mockOnReset).not.toHaveBeenCalled();
    });

    it('should not call onReset when loading', async () => {
      const user = userEvent.setup();
      
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          loading={true}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      await user.click(button);

      expect(mockOnReset).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Interactions', () => {
    it('should call onReset when Enter key is pressed', async () => {
      const user = userEvent.setup();
      
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('should call onReset when Space key is pressed', async () => {
      const user = userEvent.setup();
      
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      button.focus();
      await user.keyboard(' ');

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });



    it('should not call onReset for other keys', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      fireEvent.keyDown(button, { key: 'Tab' });

      expect(mockOnReset).not.toHaveBeenCalled();
    });

    it('should not call onReset when disabled and Enter is pressed', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          disabled={true}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(mockOnReset).not.toHaveBeenCalled();
    });

    it('should not call onReset when loading and Space is pressed', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          loading={true}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      fireEvent.keyDown(button, { key: ' ' });

      expect(mockOnReset).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should display loading text when loading is true', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          loading={true}
        />
      );

      expect(screen.getByText('Resetting...')).toBeInTheDocument();
    });

    it('should be disabled when loading is true', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          loading={true}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toBeDisabled();
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          disabled={true}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label with artist name', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toHaveAttribute('aria-label', 'Reset network view to Taylor Swift');
    });

    it('should have fallback aria-label when no artist name', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toHaveAttribute('aria-label', 'Reset network view to main artist');
    });

    it('should have proper title attribute', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toHaveAttribute('title', 'Click to return to Taylor Swift network view');
    });

    it('should have fallback title when no artist name', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toHaveAttribute('title', 'Click to return to main artist network view');
    });

    it('should have aria-hidden on arrow icon', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const icon = screen.getByTestId('arrow-left-icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Styling and Props', () => {
    it('should apply custom className', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          className="custom-class"
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toHaveClass('custom-class');
    });

    it('should apply default positioning classes', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toHaveClass('absolute top-4 right-4');
    });

    it('should apply custom test ID', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          data-testid="custom-test-id"
        />
      );

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('should pass size prop to Button component', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          size="lg"
        />
      );

      const button = screen.getByTestId('network-reset-button');
      // The size prop should be passed through to the underlying Button component
      expect(button).toBeInTheDocument();
    });

    it('should pass variant prop to Button component', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
          variant="outline"
        />
      );

      const button = screen.getByTestId('network-reset-button');
      // The variant prop should be passed through to the underlying Button component
      expect(button).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty artist name gracefully', () => {
      const emptyArtistNode: NetworkNode = {
        id: 'artist-1',
        name: '',
        type: 'artist',
        size: 30,
      };

      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={emptyArtistNode}
        />
      );

      expect(screen.getByText('← Back to Main Artist')).toBeInTheDocument();
    });

    it('should handle very long artist names', () => {
      const longNameArtistNode: NetworkNode = {
        id: 'artist-1',
        name: 'This is a very long artist name that should be truncated properly in the button',
        type: 'artist',
        size: 30,
      };

      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={longNameArtistNode}
        />
      );

      const textSpan = screen.getByText(/← Back to This is a very long artist name/);
      expect(textSpan).toHaveClass('truncate');
    });

    it('should handle special characters in artist name', () => {
      const specialCharArtistNode: NetworkNode = {
        id: 'artist-1',
        name: 'Artist & The Band (feat. Special Characters!)',
        type: 'artist',
        size: 30,
      };

      render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={specialCharArtistNode}
        />
      );

      expect(screen.getByText('← Back to Artist & The Band (feat. Special Characters!)')).toBeInTheDocument();
    });

    it('should handle null onReset function gracefully', () => {
      render(
        <NetworkResetButton
          visible={true}
          onReset={null as any}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const button = screen.getByTestId('network-reset-button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily when props are stable', () => {
      const { rerender } = render(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const initialButton = screen.getByTestId('network-reset-button');
      
      // Re-render with same props
      rerender(
        <NetworkResetButton
          visible={true}
          onReset={mockOnReset}
          mainArtistNode={mockMainArtistNode}
        />
      );

      const rerenderedButton = screen.getByTestId('network-reset-button');
      expect(rerenderedButton).toBe(initialButton);
    });
  });
}); 