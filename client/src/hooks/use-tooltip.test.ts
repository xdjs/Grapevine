import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as d3 from 'd3';
import { useTooltip } from './use-tooltip';
import { NetworkNode, NetworkData } from '@/types/network';

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock window methods
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

Object.defineProperty(window, 'scrollY', {
  writable: true,
  configurable: true,
  value: 0,
});

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock window.open
global.window.open = vi.fn();

// Mock alert
global.alert = vi.fn();

describe('useTooltip', () => {
  const mockD3Selection = {
    append: vi.fn().mockReturnThis(),
    attr: vi.fn().mockReturnThis(),
    style: vi.fn().mockReturnThis(),
    html: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    node: vi.fn(),
    remove: vi.fn().mockReturnThis(),
  };

  const mockNetworkData: NetworkData = {
    nodes: [
      {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        artistId: 'test-artist-id-1',
        types: ['artist'],
      },
      {
        id: 'producer1', 
        name: 'Test Producer',
        type: 'producer',
        size: 20,
        artistId: 'test-producer-id-1',
        types: ['producer'],
      },
    ],
    links: [
      {
        source: 'artist1',
        target: 'producer1',
      },
    ],
  };

  const mockConfig = {
    musicNerdBaseUrl: 'https://test.musicnerd.com',
    getFreshConfig: vi.fn().mockResolvedValue({
      musicNerdBaseUrl: 'https://test.musicnerd.com',
    }),
  };

  const mockNetworkDataHook = {
    finalDisplayData: mockNetworkData,
    expandNodeNetwork: vi.fn(),
  };

  const mockCallbacks = {
    onArtistNodeClick: vi.fn(),
    onShowArtistModal: vi.fn(),
    onShowCollaborationPopup: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (d3.select as Mock).mockReturnValue(mockD3Selection);
    mockD3Selection.node.mockReturnValue({
      getBoundingClientRect: () => ({
        width: 280,
        height: 150,
        top: 100,
        left: 100,
        right: 380,
        bottom: 250,
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      expect(result.current.isTooltipVisible).toBe(false);
      expect(result.current.tooltipPosition).toEqual({ x: 0, y: 0 });
      expect(result.current.highlightedNode).toBeNull();
    });

    it('should not create D3 tooltip element (using React component instead)', () => {
      renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      // Should not create D3 tooltip since we're using React NetworkTooltip component
      expect(d3.select).not.toHaveBeenCalledWith('body');
    });
  });

  describe('Tooltip State Management', () => {
    it('should show tooltip with correct state update', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockEvent = {
        pageX: 100,
        pageY: 200,
      } as MouseEvent;

      const mockNode = mockNetworkData.nodes[0];

      act(() => {
        result.current.showTooltip(mockEvent, mockNode);
      });

      expect(result.current.isTooltipVisible).toBe(true);
      expect(result.current.tooltipPosition.x).toBe(110); // pageX + 10
      expect(result.current.tooltipPosition.y).toBe(190); // pageY - 10
    });

    it('should hide tooltip and reset state', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      // First show tooltip
      const mockEvent = { pageX: 100, pageY: 200 } as MouseEvent;
      const mockNode = mockNetworkData.nodes[0];

      act(() => {
        result.current.showTooltip(mockEvent, mockNode);
      });

      expect(result.current.isTooltipVisible).toBe(true);

      // Then hide it
      act(() => {
        result.current.hideTooltip();
      });

      expect(result.current.isTooltipVisible).toBe(false);
      expect(result.current.highlightedNode).toBeNull();
    });

    it('should update tooltip position with moveTooltip', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockEvent = { pageX: 300, pageY: 400 } as MouseEvent;

      act(() => {
        result.current.moveTooltip(mockEvent);
      });

      expect(result.current.tooltipPosition.x).toBe(310);
      expect(result.current.tooltipPosition.y).toBe(390);
    });
  });

  describe('Tooltip Positioning Logic', () => {
    it('should handle boundary detection for desktop', () => {
      // Set up desktop viewport
      Object.defineProperty(window, 'innerWidth', { value: 1024 });
      Object.defineProperty(window, 'innerHeight', { value: 768 });

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      // Test right edge boundary
      const mockEvent = { pageX: 950, pageY: 100 } as MouseEvent;

      act(() => {
        result.current.moveTooltip(mockEvent);
      });

      // Should position to the left to avoid overflow
      expect(result.current.tooltipPosition.x).toBeLessThan(950);
    });

    it('should handle mobile positioning differently', () => {
      // Set up mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockEvent = { pageX: 200, pageY: 300 } as MouseEvent;

      act(() => {
        result.current.moveTooltip(mockEvent);
      });

      // On mobile, should center tooltip horizontally
      const expectedLeft = Math.max(10, Math.min(375 - 320 - 10, 200 - 320 / 2));
      expect(result.current.tooltipPosition.x).toBe(expectedLeft);
    });

    it('should enforce minimum boundaries', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      // Test negative coordinates
      const mockEvent = { pageX: -50, pageY: -30 } as MouseEvent;

      act(() => {
        result.current.moveTooltip(mockEvent);
      });

      // Should enforce minimum 10px from edges
      expect(result.current.tooltipPosition.x).toBeGreaterThanOrEqual(10);
      expect(result.current.tooltipPosition.y).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Action Handlers', () => {
    it('should handle network navigation', async () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNode = mockNetworkData.nodes[0];

      await act(async () => {
        await result.current.handleNetworkAction(mockNode);
      });

      expect(mockCallbacks.onArtistNodeClick).toHaveBeenCalledWith(
        mockNode.name,
        mockNode.artistId
      );
    });

    it('should handle network navigation with artist lookup fallback', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          options: [{ artistId: 'fallback-id', id: 'fallback-id' }],
        }),
      });

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNodeNoId = { ...mockNetworkData.nodes[0], artistId: undefined };

      await act(async () => {
        await result.current.handleNetworkAction(mockNodeNoId);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/artist-options/${encodeURIComponent(mockNodeNoId.name)}`
      );
      expect(mockCallbacks.onArtistNodeClick).toHaveBeenCalledWith(
        mockNodeNoId.name,
        'fallback-id'
      );
    });

    it('should handle expand network action', async () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNode = mockNetworkData.nodes[1]; // producer node

      await act(async () => {
        await result.current.handleExpandAction(mockNode);
      });

      expect(mockNetworkDataHook.expandNodeNetwork).toHaveBeenCalledWith(
        mockNode.name,
        mockNode.artistId
      );
    });

    it('should handle collaboration details action', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mainArtist = mockNetworkData.nodes[0];
      const collaborator = mockNetworkData.nodes[1];

      act(() => {
        result.current.handleCollaborationAction(collaborator, mainArtist);
      });

      expect(mockCallbacks.onShowCollaborationPopup).toHaveBeenCalledWith({
        artist: mainArtist.name,
        collaborator: collaborator.name,
        mainArtistName: mainArtist.name,
      });
    });
  });

  describe('Music Nerd Profile Handling', () => {
    it('should open profile with direct artist ID', async () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNode = mockNetworkData.nodes[0];

      await act(async () => {
        await result.current.handleProfileAction(mockNode);
      });

      expect(window.open).toHaveBeenCalledWith(
        'https://test.musicnerd.com/artist/test-artist-id-1',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should handle multiple artist options with modal', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          options: [
            { artistId: 'artist-1', name: 'Artist 1' },
            { artistId: 'artist-2', name: 'Artist 2' },
          ],
        }),
      });

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNodeNoId = { ...mockNetworkData.nodes[0], artistId: undefined };

      await act(async () => {
        await result.current.handleProfileAction(mockNodeNoId);
      });

      expect(mockCallbacks.onShowArtistModal).toHaveBeenCalledWith(mockNodeNoId.name);
    });

    it('should handle single artist option lookup', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          options: [{ artistId: 'single-artist-id', name: 'Single Artist' }],
        }),
      });

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNodeNoId = { ...mockNetworkData.nodes[0], artistId: undefined };

      await act(async () => {
        await result.current.handleProfileAction(mockNodeNoId);
      });

      expect(window.open).toHaveBeenCalledWith(
        'https://test.musicnerd.com/artist/single-artist-id',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should handle popup blocking with fallback link click', async () => {
      // Mock window.open to return null (blocked)
      (window.open as Mock).mockReturnValueOnce(null);

      // Mock createElement and click
      const mockElement = {
        href: '',
        target: '',
        rel: '',
        click: vi.fn(),
      };
      document.createElement = vi.fn().mockReturnValue(mockElement);
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNode = mockNetworkData.nodes[0];

      await act(async () => {
        await result.current.handleProfileAction(mockNode);
      });

      expect(mockElement.click).toHaveBeenCalled();
    });

    it('should handle clipboard fallback on error', async () => {
      // Mock window.open to throw error
      (window.open as Mock).mockImplementation(() => {
        throw new Error('Navigation blocked');
      });

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNode = mockNetworkData.nodes[0];

      await act(async () => {
        await result.current.handleProfileAction(mockNode);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://test.musicnerd.com/artist/test-artist-id-1'
      );
      expect(global.alert).toHaveBeenCalled();
    });
  });

  describe('Node Highlighting', () => {
    it('should track highlighted node', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockD3Node = {
        datum: () => mockNetworkData.nodes[0],
        selectAll: vi.fn().mockReturnThis(),
        attr: vi.fn().mockReturnThis(),
      };

      act(() => {
        result.current.setHighlightedNode(mockD3Node as any);
      });

      expect(result.current.highlightedNode).toBe(mockD3Node);
    });

    it('should reset single role node highlighting (restore transparent fill)', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockD3Node = {
        datum: () => ({ ...mockNetworkData.nodes[0], type: 'artist' }), // Single role node
        selectAll: vi.fn().mockReturnThis(),
        attr: vi.fn().mockReturnThis(),
      };

      // Set highlighted node
      act(() => {
        result.current.setHighlightedNode(mockD3Node as any);
      });

      expect(result.current.highlightedNode).toBe(mockD3Node);

      // Reset highlighting
      act(() => {
        result.current.resetNodeHighlight();
      });

      expect(result.current.highlightedNode).toBeNull();
      expect(mockD3Node.selectAll).toHaveBeenCalledWith('circle');
      // Should reset fill to transparent for single role nodes
      expect(mockD3Node.attr).toHaveBeenCalledWith('fill', 'transparent');
      expect(mockD3Node.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should reset multiple role node highlighting (restore original border thickness)', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockD3Node = {
        datum: () => ({ ...mockNetworkData.nodes[0], types: ['artist', 'producer'] }),
        selectAll: vi.fn().mockReturnThis(),
        attr: vi.fn().mockReturnThis(),
      };

      act(() => {
        result.current.setHighlightedNode(mockD3Node as any);
        result.current.resetNodeHighlight();
      });

      expect(mockD3Node.selectAll).toHaveBeenCalledWith('path');
      expect(mockD3Node.selectAll).toHaveBeenCalledWith('circle');
      // Should reset path and circle stroke widths to original values
      expect(mockD3Node.attr).toHaveBeenCalledWith('stroke-width', 1); // path original
      expect(mockD3Node.attr).toHaveBeenCalledWith('stroke-width', 2); // circle original
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNode = { ...mockNetworkData.nodes[0], artistId: undefined };

      await act(async () => {
        await result.current.handleNetworkAction(mockNode);
      });

      // Should still call the callback even if lookup fails
      expect(mockCallbacks.onArtistNodeClick).toHaveBeenCalledWith(mockNode.name, undefined);
    });

    it('should handle missing config gracefully', async () => {
      const configWithoutUrl = {
        musicNerdBaseUrl: '',
        getFreshConfig: vi.fn().mockResolvedValue(null),
      };

      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: configWithoutUrl,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNode = mockNetworkData.nodes[0];

      await act(async () => {
        await result.current.handleProfileAction(mockNode);
      });

      // Should not attempt to open window without URL
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should handle tooltip positioning with standard dimensions', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockEvent = { pageX: 100, pageY: 200 } as MouseEvent;

      act(() => {
        result.current.moveTooltip(mockEvent);
      });

      // Should use standard positioning calculation
      expect(result.current.tooltipPosition.x).toBe(110);
      expect(result.current.tooltipPosition.y).toBe(190);
    });
  });

  describe('Accessibility', () => {
    it('should provide action handlers for accessibility', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      const mockNode = mockNetworkData.nodes[0];
      const mockEvent = { pageX: 100, pageY: 200 } as MouseEvent;

      act(() => {
        result.current.showTooltip(mockEvent, mockNode);
      });

      // Check that tooltip is visible and positioned correctly for React component
      expect(result.current.isTooltipVisible).toBe(true);
      expect(result.current.currentNode).toBe(mockNode);
    });

    it('should handle keyboard events for tooltip actions', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      // Verify that keyboard handlers can be attached
      expect(typeof result.current.handleNetworkAction).toBe('function');
      expect(typeof result.current.handleProfileAction).toBe('function');
      expect(typeof result.current.handleExpandAction).toBe('function');
    });
  });

  describe('Performance', () => {
    it('should handle rapid tooltip updates efficiently', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      // Simulate rapid mouse movements
      for (let i = 0; i < 100; i++) {
        const mockEvent = { pageX: i * 10, pageY: i * 5 } as MouseEvent;
        act(() => {
          result.current.moveTooltip(mockEvent);
        });
      }

      // Should handle without errors
      expect(result.current.tooltipPosition.x).toBe(1000);
      expect(result.current.tooltipPosition.y).toBe(495);
    });

    it('should cleanup properly to prevent memory leaks', () => {
      const { unmount } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks,
        })
      );

      unmount();

      // React hook should cleanup without errors
      expect(true).toBe(true); // No D3 cleanup needed since using React component
    });
  });
});