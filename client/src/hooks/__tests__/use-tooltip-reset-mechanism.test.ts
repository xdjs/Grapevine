import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTooltip } from '../use-tooltip';
import { NetworkNode } from '@/types/network';

// Mock selection with proper chaining
const mockSelection = {
  selectAll: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  datum: vi.fn()
};

// Mock d3
vi.mock('d3', () => ({
  select: vi.fn(() => mockSelection)
}));

describe('useTooltip - Reset Mechanism', () => {
  const mockNetworkData = {
    nodes: [
      { id: 'artist1', name: 'Taylor Swift', type: 'artist', size: 25, x: 100, y: 100 }
    ],
    links: []
  };

  const mockConfig = {
    musicNerdBaseUrl: 'https://musicnerd.app',
    getFreshConfig: vi.fn().mockResolvedValue({ musicNerdBaseUrl: 'https://musicnerd.app' })
  };

  const mockNetworkDataHook = {
    finalDisplayData: mockNetworkData,
    expandNodeNetwork: vi.fn()
  };

  const mockCallbacks = {
    onArtistNodeClick: vi.fn(),
    onShowArtistModal: vi.fn(),
    onShowCollaborationPopup: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection.selectAll.mockReturnValue(mockSelection);
  });

  describe('Single Role Node Reset', () => {
    it('should reset single-role artist node to original magenta pink stroke', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      const artistNode: NetworkNode = {
        id: 'artist1',
        name: 'Taylor Swift',
        type: 'artist',
        size: 25,
        x: 100,
        y: 100
      };

      // Mock the highlighted node with proper datum
      mockSelection.datum.mockReturnValue(artistNode);

      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      act(() => {
        result.current.resetNodeHighlight();
      });

      // Verify circles were selected and reset to magenta pink
      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#FF0ACF'); // Magenta Pink
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should reset single-role producer node to original bright purple stroke', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      const producerNode: NetworkNode = {
        id: 'producer1',
        name: 'Jack Antonoff',
        type: 'producer',
        size: 20,
        x: 200,
        y: 200
      };

      mockSelection.datum.mockReturnValue(producerNode);

      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      act(() => {
        result.current.resetNodeHighlight();
      });

      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#AE53FF'); // Bright Purple
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should reset single-role songwriter node to original light blue stroke', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      const songwriterNode: NetworkNode = {
        id: 'songwriter1',
        name: 'Lorde',
        type: 'songwriter',
        size: 18,
        x: 300,
        y: 300
      };

      mockSelection.datum.mockReturnValue(songwriterNode);

      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      act(() => {
        result.current.resetNodeHighlight();
      });

      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#67D1F8'); // Light Blue
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should reset unknown role node to default police blue stroke', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      const unknownNode: NetworkNode = {
        id: 'unknown1',
        name: 'Unknown Role',
        type: 'unknown' as any,
        size: 15,
        x: 400,
        y: 400
      };

      mockSelection.datum.mockReturnValue(unknownNode);

      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      act(() => {
        result.current.resetNodeHighlight();
      });

      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#355367'); // Police Blue
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });
  });

  describe('Multi-Role Node Reset', () => {
    it('should reset multi-role node paths and inner circle to white strokes', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      const multiRoleNode: NetworkNode = {
        id: 'multi1',
        name: 'Jack Antonoff',
        type: 'artist',
        types: ['artist', 'producer', 'songwriter'],
        size: 25,
        x: 500,
        y: 500
      };

      mockSelection.datum.mockReturnValue(multiRoleNode);

      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      act(() => {
        result.current.resetNodeHighlight();
      });

      // Verify paths were reset to white strokes
      expect(mockSelection.selectAll).toHaveBeenCalledWith('path');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', 'white');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 1);

      // Verify inner circle was reset to white stroke
      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', 'white');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 2);
    });

    it('should handle multi-role node with types array properly', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      const artistProducerNode: NetworkNode = {
        id: 'artistproducer1',
        name: 'Artist Producer',
        type: 'artist',
        types: ['artist', 'producer'],
        size: 22,
        x: 600,
        y: 600
      };

      mockSelection.datum.mockReturnValue(artistProducerNode);

      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      const resetResult = act(() => {
        result.current.resetNodeHighlight();
      });

      // Should handle as multi-role (length > 1)
      expect(mockSelection.selectAll).toHaveBeenCalledWith('path');
      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
    });
  });

  describe('Reset State Management', () => {
    it('should clear highlighted node state after reset', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      const node: NetworkNode = {
        id: 'test1',
        name: 'Test Node',
        type: 'artist',
        size: 25,
        x: 100,
        y: 100
      };

      mockSelection.datum.mockReturnValue(node);

      // Set highlighted node
      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      expect(result.current.highlightedNode).toBe(mockSelection);

      // Reset highlighting
      act(() => {
        result.current.resetNodeHighlight();
      });

      expect(result.current.highlightedNode).toBe(null);
    });

    it('should handle reset when no node is highlighted', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      // Should not throw error when no node is highlighted
      expect(() => {
        act(() => {
          result.current.resetNodeHighlight();
        });
      }).not.toThrow();

      // Selection methods should not be called
      expect(mockSelection.selectAll).not.toHaveBeenCalled();
      expect(mockSelection.attr).not.toHaveBeenCalled();
    });

    it('should handle reset when highlightedNode datum returns undefined', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      // Mock datum to return undefined
      mockSelection.datum.mockReturnValue(undefined);

      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      // Should handle gracefully without errors
      expect(() => {
        act(() => {
          result.current.resetNodeHighlight();
        });
      }).not.toThrow();
    });
  });

  describe('Hide Tooltip Integration', () => {
    it('should reset highlighting when hiding tooltip', () => {
      const { result } = renderHook(() =>
        useTooltip({
          networkData: mockNetworkData,
          config: mockConfig,
          networkDataHook: mockNetworkDataHook,
          callbacks: mockCallbacks
        })
      );

      const node: NetworkNode = {
        id: 'test2',
        name: 'Test Node 2',
        type: 'artist',
        size: 25,
        x: 100,
        y: 100
      };

      mockSelection.datum.mockReturnValue(node);

      // Set up highlighted state
      act(() => {
        result.current.setHighlightedNode(mockSelection);
      });

      expect(result.current.highlightedNode).toBe(mockSelection);

      // Hide tooltip should reset highlighting
      act(() => {
        result.current.hideTooltip();
      });

      expect(result.current.highlightedNode).toBe(null);
      expect(result.current.isTooltipVisible).toBe(false);
      expect(result.current.currentNode).toBe(null);
    });
  });

  describe('Role Color Mapping', () => {
    const roleColorTests = [
      { type: 'artist', expectedColor: '#FF0ACF', name: 'Magenta Pink' },
      { type: 'producer', expectedColor: '#AE53FF', name: 'Bright Purple' },
      { type: 'songwriter', expectedColor: '#67D1F8', name: 'Light Blue' },
      { type: 'other', expectedColor: '#355367', name: 'Police Blue (default)' }
    ];

    roleColorTests.forEach(({ type, expectedColor, name }) => {
      it(`should use correct color (${name}) for ${type} role`, () => {
        const { result } = renderHook(() =>
          useTooltip({
            networkData: mockNetworkData,
            config: mockConfig,
            networkDataHook: mockNetworkDataHook,
            callbacks: mockCallbacks
          })
        );

        const node: NetworkNode = {
          id: `${type}1`,
          name: `Test ${type}`,
          type: type as any,
          size: 20,
          x: 100,
          y: 100
        };

        mockSelection.datum.mockReturnValue(node);

        act(() => {
          result.current.setHighlightedNode(mockSelection);
        });

        act(() => {
          result.current.resetNodeHighlight();
        });

        expect(mockSelection.attr).toHaveBeenCalledWith('stroke', expectedColor);
      });
    });
  });
});
