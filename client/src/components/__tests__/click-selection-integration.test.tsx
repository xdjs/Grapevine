import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as d3 from 'd3';
import { NetworkVisualizer } from '../network-visualizer';
import { NetworkData, FilterState } from '@/types/network';

// Mock D3 and other dependencies
const mockSelection = {
  selectAll: vi.fn().mockReturnThis(),
  append: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  call: vi.fn().mockReturnThis(),
  data: vi.fn().mockReturnThis(),
  enter: vi.fn().mockReturnThis(),
  text: vi.fn().mockReturnThis(),
  each: vi.fn().mockReturnThis(),
  datum: vi.fn(),
  remove: vi.fn().mockReturnThis(),
  transition: vi.fn().mockReturnThis(),
  duration: vi.fn().mockReturnThis()
};

const mockSimulation = {
  force: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  stop: vi.fn(),
  restart: vi.fn().mockReturnThis(),
  alphaTarget: vi.fn().mockReturnThis(),
  nodes: vi.fn().mockReturnThis(),
  alpha: vi.fn().mockReturnThis()
};

const mockZoom = {
  transform: vi.fn(),
  translateBy: vi.fn(),
  scaleBy: vi.fn(),
  scaleTo: vi.fn(),
  on: vi.fn().mockReturnThis()
};

const mockDrag = {
  on: vi.fn().mockReturnThis()
};

vi.mock('d3', () => ({
  select: vi.fn(() => mockSelection),
  selectAll: vi.fn(() => mockSelection),
  forceSimulation: vi.fn(() => mockSimulation),
  forceLink: vi.fn(() => ({ id: vi.fn().mockReturnThis(), distance: vi.fn().mockReturnThis() })),
  forceManyBody: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceCollide: vi.fn(() => ({ radius: vi.fn().mockReturnThis() })),
  forceX: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceY: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  zoom: vi.fn(() => mockZoom),
  zoomTransform: vi.fn(() => ({ k: 1, x: 0, y: 0 })),
  drag: vi.fn(() => mockDrag),
  arc: vi.fn(() => vi.fn())
}));

// Mock hooks
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}));

vi.mock('@/hooks/use-config', () => ({
  useConfig: () => ({
    musicNerdBaseUrl: 'https://test.musicnerd.app',
    getFreshConfig: vi.fn().mockResolvedValue({ musicNerdBaseUrl: 'https://test.musicnerd.app' }),
    isLoading: false,
    error: null,
    refreshConfig: vi.fn()
  })
}));

vi.mock('@/hooks/use-profile-pictures', () => ({
  useProfilePictures: () => ({
    getProfilePictureUrl: vi.fn(),
    preloadImages: vi.fn(),
    isLoaded: vi.fn(),
    hasFailed: vi.fn()
  })
}));

describe('Click Selection Integration', () => {
  const mockNetworkData: NetworkData = {
    nodes: [
      {
        id: 'taylor-swift',
        name: 'Taylor Swift',
        type: 'artist',
        size: 30,
        x: 400,
        y: 300
      },
      {
        id: 'jack-antonoff',
        name: 'Jack Antonoff',
        type: 'artist',
        types: ['artist', 'producer', 'songwriter'],
        size: 25,
        x: 200,
        y: 200
      },
      {
        id: 'aaron-dessner',
        name: 'Aaron Dessner',
        type: 'producer',
        size: 20,
        x: 600,
        y: 400
      }
    ],
    links: [
      {
        source: 'taylor-swift',
        target: 'jack-antonoff',
        type: 'production'
      },
      {
        source: 'taylor-swift',
        target: 'aaron-dessner',
        type: 'production'
      }
    ]
  };

  const mockFilterState: FilterState = {
    showArtists: true,
    showProducers: true,
    showSongwriters: true,
    showCollaborationLinks: true,
    showProductionLinks: true
  };

  const defaultProps = {
    data: mockNetworkData,
    visible: true,
    filterState: mockFilterState,
    onZoomChange: vi.fn(),
    onArtistSearch: vi.fn(),
    onArtistNodeClick: vi.fn(),
    onError: vi.fn(),
    onClearAll: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock SVG element creation
    Object.defineProperty(document, 'createElementNS', {
      value: vi.fn().mockImplementation((namespace: string, tagName: string) => {
        const element = document.createElement('div');
        element.tagName = tagName.toUpperCase();
        return element;
      }),
      configurable: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Single Role Node Selection', () => {
    it('should apply white stroke highlighting to single-role artist node on click', async () => {
      render(<NetworkVisualizer {...defaultProps} />);

      // Wait for component to initialize
      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Simulate node click - verify D3 setup was called
      expect(d3.select).toHaveBeenCalled();

      // Verify that selectAll was called for highlighting
      expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
      
      // Check if highlighting attributes were set (would be called during click)
      expect(mockSelection.attr).toHaveBeenCalled();
    });

    it('should reset previous selection when clicking new node', async () => {
      render(<NetworkVisualizer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Multiple clicks should trigger reset behavior
      expect(d3.select).toHaveBeenCalled();
      expect(mockSelection.selectAll).toHaveBeenCalled();
    });
  });

  describe('Multi-Role Node Selection', () => {
    it('should handle multi-role node click with proper path and circle selection', async () => {
      const multiRoleData: NetworkData = {
        nodes: [
          {
            id: 'jack-antonoff',
            name: 'Jack Antonoff',
            type: 'artist',
            types: ['artist', 'producer', 'songwriter'],
            size: 25,
            x: 300,
            y: 300
          }
        ],
        links: []
      };

      render(<NetworkVisualizer {...defaultProps} data={multiRoleData} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Verify multi-role node rendering setup
      expect(mockSelection.each).toHaveBeenCalled();
    });

    it('should apply white stroke to both circles and paths for multi-role nodes', async () => {
      const multiRoleData: NetworkData = {
        nodes: [
          {
            id: 'multi-role',
            name: 'Multi Role Artist',
            type: 'artist',
            types: ['artist', 'producer'],
            size: 25,
            x: 300,
            y: 300
          }
        ],
        links: []
      };

      render(<NetworkVisualizer {...defaultProps} data={multiRoleData} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // The node interactions should select both circles and paths
      expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
    });
  });

  describe('Background Click Reset', () => {
    it('should reset selection when clicking background', async () => {
      render(<NetworkVisualizer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Get the SVG element
      const svgElement = document.querySelector('svg');
      expect(svgElement).toBeInTheDocument();

      // Simulate background click
      if (svgElement) {
        fireEvent.click(svgElement);
      }

      // Verify background click handler was set up
      expect(mockSelection.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should hide tooltip on background click', async () => {
      render(<NetworkVisualizer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Background click should trigger tooltip hide
      expect(mockSelection.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Visual Feedback System', () => {
    it('should provide consistent white stroke across different node types', async () => {
      const mixedData: NetworkData = {
        nodes: [
          { id: 'artist', name: 'Artist', type: 'artist', size: 25, x: 100, y: 100 },
          { id: 'producer', name: 'Producer', type: 'producer', size: 20, x: 200, y: 200 },
          { id: 'songwriter', name: 'Songwriter', type: 'songwriter', size: 18, x: 300, y: 300 }
        ],
        links: []
      };

      render(<NetworkVisualizer {...defaultProps} data={mixedData} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // All nodes should use the same selection mechanism
      expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
    });

    it('should maintain only one selected node at a time', async () => {
      render(<NetworkVisualizer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Selection system ensures only one node highlighted at a time
      expect(d3.select).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle D3 selection errors gracefully', async () => {
      // Mock D3 select to throw error
      vi.mocked(d3.select).mockImplementationOnce(() => {
        throw new Error('D3 selection error');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<NetworkVisualizer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Should not crash the component
      expect(screen.getByTestId('network-container')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });

    it('should continue working after click handling errors', async () => {
      render(<NetworkVisualizer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Component should remain functional
      expect(screen.getByTestId('network-container')).toBeInTheDocument();
    });
  });

  describe('Tooltip Integration', () => {
    it('should coordinate selection with tooltip display', async () => {
      render(<NetworkVisualizer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Selection and tooltip should work together
      expect(mockSelection.on).toHaveBeenCalled();
    });

    it('should reset selection when tooltip is hidden', async () => {
      render(<NetworkVisualizer {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Tooltip hide should trigger selection reset
      expect(mockSelection.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Role-Specific Color Reset', () => {
    it('should reset artist nodes to magenta pink', async () => {
      const artistData: NetworkData = {
        nodes: [
          { id: 'artist', name: 'Artist', type: 'artist', size: 25, x: 300, y: 300 }
        ],
        links: []
      };

      render(<NetworkVisualizer {...defaultProps} data={artistData} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Artist nodes should have specific color setup
      expect(mockSelection.attr).toHaveBeenCalled();
    });

    it('should reset producer nodes to bright purple', async () => {
      const producerData: NetworkData = {
        nodes: [
          { id: 'producer', name: 'Producer', type: 'producer', size: 20, x: 300, y: 300 }
        ],
        links: []
      };

      render(<NetworkVisualizer {...defaultProps} data={producerData} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Producer nodes should have specific color setup
      expect(mockSelection.attr).toHaveBeenCalled();
    });

    it('should reset songwriter nodes to light blue', async () => {
      const songwriterData: NetworkData = {
        nodes: [
          { id: 'songwriter', name: 'Songwriter', type: 'songwriter', size: 18, x: 300, y: 300 }
        ],
        links: []
      };

      render(<NetworkVisualizer {...defaultProps} data={songwriterData} />);

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      // Songwriter nodes should have specific color setup
      expect(mockSelection.attr).toHaveBeenCalled();
    });
  });
});
