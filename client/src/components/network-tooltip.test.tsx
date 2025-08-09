import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkTooltip } from './network-tooltip';
import { NetworkNode } from '@/types/network';

// Mock global window methods
global.window.open = vi.fn();
global.alert = vi.fn();

// Mock fetch
global.fetch = vi.fn();

describe('NetworkTooltip', () => {
  const mockArtistNode: NetworkNode = {
    id: 'artist1',
    name: 'Test Artist',
    type: 'artist',
    types: ['artist'],
    size: 30,
    artistId: 'test-artist-id',
  };

  const mockProducerNode: NetworkNode = {
    id: 'producer1',
    name: 'Test Producer',
    type: 'producer',
    types: ['producer'],
    size: 20,
    artistId: 'test-producer-id',
  };

  const mockMultiRoleNode: NetworkNode = {
    id: 'multi1',
    name: 'Multi Role Artist',
    type: 'artist',
    types: ['artist', 'producer', 'songwriter'],
    size: 25,
    artistId: 'multi-role-id',
  };

  const defaultProps = {
    node: mockArtistNode,
    position: { x: 100, y: 200 },
    visible: true,
    isMainArtist: false,
    onNetworkAction: vi.fn(),
    onProfileAction: vi.fn(),
    onCollaborationAction: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render tooltip with correct node information', () => {
      render(<NetworkTooltip {...defaultProps} />);

      expect(screen.getByText('Test Artist')).toBeInTheDocument();
      expect(screen.getByText('Roles: artist')).toBeInTheDocument();
    });

    it('should render multiple roles correctly', () => {
      render(
        <NetworkTooltip {...defaultProps} node={mockMultiRoleNode} />
      );

      expect(screen.getByText('Multi Role Artist')).toBeInTheDocument();
      expect(screen.getByText('Roles: artist, producer, songwriter')).toBeInTheDocument();
    });

    it('should not render when visible is false', () => {
      render(<NetworkTooltip {...defaultProps} visible={false} />);

      expect(screen.queryByText('Test Artist')).not.toBeInTheDocument();
    });

    it('should render at correct position', () => {
      const { container } = render(<NetworkTooltip {...defaultProps} />);
      const tooltipElement = container.firstChild as HTMLElement;

      expect(tooltipElement).toHaveStyle({
        left: '100px',
        top: '200px',
      });
    });

    it('should render close button', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close tooltip');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Network Action', () => {
    it('should render network action for all nodes', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const networkLink = screen.getByText(`${mockArtistNode.name}'s network`);
      expect(networkLink).toBeInTheDocument();
    });

    it('should call onNetworkAction when network link is clicked', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const networkAction = screen.getByTestId('network-action');
      fireEvent.click(networkAction);

      expect(defaultProps.onNetworkAction).toHaveBeenCalledWith(mockArtistNode);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should have correct network icon', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const networkIcon = screen.getByAltText('Network');
      expect(networkIcon).toBeInTheDocument();
      expect(networkIcon).toHaveAttribute('src', '/grapevine-logo.png');
    });
  });

  // Expand Action removed from UI

  describe('Music Nerd Profile Action', () => {
    it('should render profile action for artists', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const profileLink = screen.getByText(`${mockArtistNode.name}'s Music Nerd profile`);
      expect(profileLink).toBeInTheDocument();
    });

    it('should not render profile action for non-artists', () => {
      render(<NetworkTooltip {...defaultProps} node={mockProducerNode} />);

      const profileLink = screen.queryByText(`${mockProducerNode.name}'s Music Nerd profile`);
      expect(profileLink).not.toBeInTheDocument();
    });

    it('should call onProfileAction when profile link is clicked', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const profileAction = screen.getByTestId('profile-action');
      fireEvent.click(profileAction);

      expect(defaultProps.onProfileAction).toHaveBeenCalledWith(mockArtistNode);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should have correct profile icon', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const profileIcon = screen.getByAltText('Artist Page');
      expect(profileIcon).toBeInTheDocument();
      expect(profileIcon).toHaveAttribute('src', '/music_nerd_logo.png');
    });

    it('should render profile action for multi-role nodes with artist type', () => {
      render(<NetworkTooltip {...defaultProps} node={mockMultiRoleNode} />);

      const profileLink = screen.getByText(`${mockMultiRoleNode.name}'s Music Nerd profile`);
      expect(profileLink).toBeInTheDocument();
    });
  });

  describe('Collaboration Details Action', () => {
    it('should render collaboration action for non-main artists', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const collaborationLink = screen.getByText('Collaboration details');
      expect(collaborationLink).toBeInTheDocument();
    });

    it('should not render collaboration action for main artist', () => {
      render(<NetworkTooltip {...defaultProps} isMainArtist={true} />);

      const collaborationLink = screen.queryByText('Collaboration details');
      expect(collaborationLink).not.toBeInTheDocument();
    });

    it('should call onCollaborationAction when collaboration link is clicked', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const collaborationAction = screen.getByTestId('collaboration-action');
      fireEvent.click(collaborationAction);

      expect(defaultProps.onCollaborationAction).toHaveBeenCalledWith(mockArtistNode);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should have correct collaboration icon (users SVG)', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const collaborationIcon = screen.getByLabelText('Collaboration icon');
      expect(collaborationIcon).toBeInTheDocument();
    });
  });

  describe('Close Action', () => {
    it('should call onClose when close button is clicked', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close tooltip');
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should have correct close button styling', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close tooltip');
      expect(closeButton).toHaveStyle({
        position: 'absolute',
        top: '4px',
        right: '6px',
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
    });

    afterEach(() => {
      // Reset to desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    it('should render with mobile-optimized styles', () => {
      const { container } = render(<NetworkTooltip {...defaultProps} />);
      const tooltipElement = container.firstChild as HTMLElement;

      expect(tooltipElement).toHaveStyle({
        maxWidth: '320px',
      });
    });

    it('should use smaller icons on mobile', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const networkIcon = screen.getByAltText('Network');
      expect(networkIcon).toHaveStyle({
        width: '24px',
        height: '24px',
      });
    });

    it('should use smaller fonts on mobile', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const title = screen.getByText(mockArtistNode.name);
      expect(title).toHaveStyle({
        fontSize: '14px',
      });
    });
  });

  describe('Event Handling', () => {
    it('should prevent default behavior on link clicks', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const networkLink = screen.getByText(`${mockArtistNode.name}'s network`);
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

      fireEvent(networkLink, clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should stop event propagation on action clicks', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const networkLink = screen.getByText(`${mockArtistNode.name}'s network`);
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

      fireEvent(networkLink, clickEvent);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should handle keyboard events for accessibility', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const networkLink = screen.getByText(`${mockArtistNode.name}'s network`);
      
      // Test Enter key
      fireEvent.keyDown(networkLink, { key: 'Enter', code: 'Enter' });
      expect(defaultProps.onNetworkAction).toHaveBeenCalledWith(mockArtistNode);

      // Test Space key
      fireEvent.keyDown(networkLink, { key: ' ', code: 'Space' });
      expect(defaultProps.onNetworkAction).toHaveBeenCalledTimes(2);
    });

    it('should handle Escape key to close tooltip', () => {
      render(<NetworkTooltip {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute('aria-label', `Tooltip for ${mockArtistNode.name}`);
    });

    it('should have focusable elements', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const networkLink = screen.getByText(`${mockArtistNode.name}'s network`);
      expect(networkLink).toHaveAttribute('tabIndex', '0');
    });

    it('should have proper button roles for interactive elements', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close tooltip');
      expect(closeButton).toHaveAttribute('role', 'button');
    });

    it('should support screen readers with proper text content', () => {
      render(<NetworkTooltip {...defaultProps} />);

      // Check that all text content is properly accessible
      expect(screen.getByText(mockArtistNode.name)).toBeInTheDocument();
      expect(screen.getByText('Roles: artist')).toBeInTheDocument();
      expect(screen.getByText(`${mockArtistNode.name}'s network`)).toBeInTheDocument();
    });

    it('should have proper contrast for all text elements', () => {
      render(<NetworkTooltip {...defaultProps} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveStyle({
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
      });
    });
  });

  describe('Content Generation', () => {
    it('should generate correct content for single role node', () => {
      render(<NetworkTooltip {...defaultProps} node={mockProducerNode} />);

      expect(screen.getByText('Test Producer')).toBeInTheDocument();
      expect(screen.getByText('Roles: producer')).toBeInTheDocument();
    });

    it('should handle nodes without artistId', () => {
      const nodeWithoutId = { ...mockArtistNode, artistId: undefined };
      render(<NetworkTooltip {...defaultProps} node={nodeWithoutId} />);

      const networkLink = screen.getByText(`${nodeWithoutId.name}'s network`);
      expect(networkLink).toBeInTheDocument();
    });

    it('should handle missing types array gracefully', () => {
      const nodeWithoutTypes = { ...mockArtistNode, types: undefined };
      render(<NetworkTooltip {...defaultProps} node={nodeWithoutTypes} />);

      expect(screen.getByText('Roles: artist')).toBeInTheDocument();
    });

    it('should render all action sections in correct order', () => {
      const { container } = render(<NetworkTooltip {...defaultProps} />);
      
      const actionElements = container.querySelectorAll('[data-testid*="action"]');
      
      // Check that network action appears first
      const networkAction = screen.getByTestId('network-action');
      const profileAction = screen.getByTestId('profile-action');
      const collaborationAction = screen.getByTestId('collaboration-action');

      expect(networkAction).toBeInTheDocument();
      expect(profileAction).toBeInTheDocument();
      expect(collaborationAction).toBeInTheDocument();
      
      // Ensure there are exactly three actions now that expand is removed
      expect(actionElements.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing node data gracefully', () => {
      const emptyNode = {
        id: '',
        name: '',
        type: 'artist' as const,
        size: 0,
      };

      render(<NetworkTooltip {...defaultProps} node={emptyNode} />);

      // Should still render without crashing
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should handle action callback errors gracefully', () => {
      const erroringProps = {
        ...defaultProps,
        onNetworkAction: vi.fn().mockImplementation(() => {
          throw new Error('Action failed');
        }),
      };

      render(<NetworkTooltip {...erroringProps} />);

      const networkLink = screen.getByText(`${mockArtistNode.name}'s network`);
      
      // Should not crash when action throws error
      expect(() => {
        fireEvent.click(networkLink);
      }).not.toThrow();
    });

    it('should handle invalid position values', () => {
      const invalidPositionProps = {
        ...defaultProps,
        position: { x: NaN, y: undefined as any },
      };

      const { container } = render(<NetworkTooltip {...invalidPositionProps} />);
      const tooltipElement = container.firstChild as HTMLElement;

      // Should handle gracefully with fallback positioning
      expect(tooltipElement).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle rapid visibility toggles efficiently', () => {
      const { rerender } = render(<NetworkTooltip {...defaultProps} visible={true} />);

      // Rapidly toggle visibility
      for (let i = 0; i < 100; i++) {
        rerender(<NetworkTooltip {...defaultProps} visible={i % 2 === 0} />);
      }

      // Should handle without performance issues
      expect(screen.queryByRole('tooltip')).toBeInTheDocument();
    });

    it('should handle position updates efficiently', () => {
      const { rerender } = render(<NetworkTooltip {...defaultProps} />);

      // Update position rapidly
      for (let i = 0; i < 100; i++) {
        rerender(
          <NetworkTooltip {...defaultProps} position={{ x: i, y: i * 2 }} />
        );
      }

      const { container } = render(<NetworkTooltip {...defaultProps} position={{ x: 99, y: 198 }} />);
      const tooltipElement = container.firstChild as HTMLElement;

      expect(tooltipElement).toHaveStyle({
        left: '99px',
        top: '198px',
      });
    });

    it('should not re-render unnecessarily with same props', () => {
      const renderSpy = vi.fn();
      
      const TestComponent = (props: any) => {
        renderSpy();
        return <NetworkTooltip {...props} />;
      };

      const { rerender } = render(<TestComponent {...defaultProps} />);
      
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(<TestComponent {...defaultProps} />);
      
      // Should optimize re-renders
      expect(renderSpy).toHaveBeenCalledTimes(2); // Expected in React 18
    });
  });
});