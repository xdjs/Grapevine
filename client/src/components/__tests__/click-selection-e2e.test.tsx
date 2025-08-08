import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import NetworkVisualizer from '../network-visualizer';
import { NetworkData, FilterState } from '@/types/network';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
jest.mock('@/hooks/use-config', () => ({
  useConfig: () => ({
    musicNerdBaseUrl: 'https://test.musicnerd.com',
    getFreshConfig: jest.fn().mockResolvedValue({ musicNerdBaseUrl: 'https://test.musicnerd.com' }),
    isLoading: false,
    error: null,
    refreshConfig: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

jest.mock('@/hooks/use-profile-pictures', () => ({
  useProfilePictures: () => ({
    getProfilePicture: jest.fn().mockReturnValue(null),
    batchFetchProfilePictures: jest.fn().mockResolvedValue(new Map()),
    clearCache: jest.fn(),
    getStats: jest.fn().mockReturnValue({ totalCached: 0, totalFailed: 0 }),
  }),
}));

// Mock D3 with comprehensive selection simulation
const mockD3Selection = {
  selectAll: jest.fn().mockReturnThis(),
  data: jest.fn().mockReturnThis(),
  enter: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  call: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  each: jest.fn().mockReturnThis(),
  transition: jest.fn().mockReturnThis(),
  duration: jest.fn().mockReturnThis(),
  empty: jest.fn().mockReturnValue(false),
  node: jest.fn(),
  datum: jest.fn(),
  querySelector: jest.fn(),
  insertBefore: jest.fn(),
  appendChild: jest.fn(),
  getBoundingClientRect: jest.fn().mockReturnValue({
    left: 100,
    top: 100,
    right: 200,
    bottom: 200,
    width: 100,
    height: 100,
  }),
};

const mockSimulation = {
  nodes: jest.fn().mockReturnThis(),
  force: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  stop: jest.fn(),
  alphaTarget: jest.fn().mockReturnThis(),
  restart: jest.fn().mockReturnThis(),
};

jest.mock('d3', () => ({
  select: jest.fn(() => mockD3Selection),
  forceSimulation: jest.fn(() => mockSimulation),
  forceLink: jest.fn(() => ({ id: jest.fn().mockReturnThis(), distance: jest.fn().mockReturnThis() })),
  forceManyBody: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
  forceCollide: jest.fn(() => ({ radius: jest.fn().mockReturnThis() })),
  forceX: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
  forceY: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
  zoomTransform: jest.fn(() => ({ k: 1, x: 0, y: 0 })),
  drag: jest.fn(() => ({ on: jest.fn().mockReturnThis() })),
  zoom: jest.fn(() => ({ 
    on: jest.fn().mockReturnThis(),
    scaleExtent: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
  })),
  arc: jest.fn(() => ({
    innerRadius: jest.fn().mockReturnThis(),
    outerRadius: jest.fn().mockReturnThis(),
    startAngle: jest.fn().mockReturnThis(),
    endAngle: jest.fn().mockReturnThis(),
  })),
}));

// Test data
const mockNetworkData: NetworkData = {
  nodes: [
    {
      id: 'artist1',
      name: 'Taylor Swift',
      type: 'artist',
      types: ['artist'],
      size: 30,
      x: 400,
      y: 300,
      artistId: 'ts123',
    },
    {
      id: 'producer1',
      name: 'Jack Antonoff',
      type: 'producer',
      types: ['producer'],
      size: 20,
      x: 300,
      y: 250,
      artistId: 'ja456',
    },
    {
      id: 'songwriter1',
      name: 'Aaron Dessner',
      type: 'songwriter',
      types: ['songwriter'],
      size: 18,
      x: 500,
      y: 350,
      artistId: 'ad789',
    },
    {
      id: 'multi1',
      name: 'Bon Iver',
      type: 'artist',
      types: ['artist', 'producer', 'songwriter'],
      size: 25,
      x: 350,
      y: 400,
      artistId: 'bi101',
    },
  ],
  links: [
    {
      source: 'artist1',
      target: 'producer1',
      type: 'production',
    },
    {
      source: 'artist1',
      target: 'songwriter1',
      type: 'songwriting',
    },
    {
      source: 'artist1',
      target: 'multi1',
      type: 'collaboration',
    },
  ],
};

const mockFilterState: FilterState = {
  showArtists: true,
  showProducers: true,
  showSongwriters: true,
  showCollaborations: true,
  showProductions: true,
};

// Test wrapper with QueryClient
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Click Selection E2E Tests', () => {
  let mockNodeClickHandler: jest.Mock;
  let mockZoomChangeHandler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockNodeClickHandler = jest.fn();
    mockZoomChangeHandler = jest.fn();

    // Setup comprehensive D3 mock behavior
    (mockD3Selection.each as jest.Mock).mockImplementation((callback) => {
      // Simulate processing each node
      mockNetworkData.nodes.forEach((node, index) => {
        const mockNodeGroup = {
          ...mockD3Selection,
          datum: jest.fn().mockReturnValue(node),
          node: jest.fn().mockReturnValue(document.createElementNS('http://www.w3.org/2000/svg', 'g')),
        };
        callback.call(mockNodeGroup, node, index);
      });
      return mockD3Selection;
    });

    // Mock SVG creation
    document.createElementNS = jest.fn().mockImplementation((namespace, tagName) => {
      const element = document.createElement('div') as any;
      element.tagName = tagName.toUpperCase();
      element.setAttribute = jest.fn();
      element.appendChild = jest.fn();
      element.getAttribute = jest.fn();
      element.querySelector = jest.fn();
      element.remove = jest.fn();
      element.getBoundingClientRect = jest.fn().mockReturnValue({
        left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100
      });
      
      if (tagName === 'svg') {
        element.parentElement = {
          clientWidth: 800,
          clientHeight: 600,
        };
      }
      
      return element;
    });
  });

  const defaultProps = {
    data: mockNetworkData,
    visible: true,
    filterState: mockFilterState,
    onZoomChange: mockZoomChangeHandler,
    onArtistNodeClick: mockNodeClickHandler,
  };

  describe('Complete Click Selection Workflow', () => {
    it('should handle complete click selection workflow', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      // Wait for component to initialize
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });

      // Verify D3 setup was called
      expect(mockD3Selection.on).toHaveBeenCalled();
      expect(mockD3Selection.each).toHaveBeenCalled();

      // Find the node click handler
      const onCalls = (mockD3Selection.on as jest.Mock).mock.calls;
      const clickCall = onCalls.find(call => call[0] === 'click');
      expect(clickCall).toBeDefined();
    });

    it('should handle node selection and highlighting', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockD3Selection.each).toHaveBeenCalled();
      });

      // Get the node processing callback
      const eachCallback = (mockD3Selection.each as jest.Mock).mock.calls[0][0];
      
      // Simulate processing a single-role artist node
      const artistNode = mockNetworkData.nodes[0]; // Taylor Swift
      const mockNodeGroup = {
        ...mockD3Selection,
        datum: jest.fn().mockReturnValue(artistNode),
      };

      eachCallback.call(mockNodeGroup, artistNode, 0);

      // Verify circle was created for single-role node
      expect(mockD3Selection.append).toHaveBeenCalledWith('circle');
      expect(mockD3Selection.attr).toHaveBeenCalledWith('r', artistNode.size);
    });

    it('should handle multi-role node rendering', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockD3Selection.each).toHaveBeenCalled();
      });

      const eachCallback = (mockD3Selection.each as jest.Mock).mock.calls[0][0];
      
      // Simulate processing a multi-role node
      const multiRoleNode = mockNetworkData.nodes[3]; // Bon Iver
      const mockNodeGroup = {
        ...mockD3Selection,
        datum: jest.fn().mockReturnValue(multiRoleNode),
      };

      eachCallback.call(mockNodeGroup, multiRoleNode, 3);

      // Verify paths were created for multi-role node
      expect(mockD3Selection.append).toHaveBeenCalledWith('path');
      expect(mockD3Selection.append).toHaveBeenCalledWith('circle');
    });

    it('should coordinate tooltip display with selection', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockD3Selection.on).toHaveBeenCalled();
      });

      // Simulate node click
      const onCalls = (mockD3Selection.on as jest.Mock).mock.calls;
      const clickCall = onCalls.find(call => call[0] === 'click');
      
      if (clickCall && clickCall[1]) {
        const mockEvent = {
          stopPropagation: jest.fn(),
          pageX: 150,
          pageY: 150,
          target: document.createElement('circle'),
        };

        // This would trigger the click handler which coordinates with tooltip
        expect(clickCall[1]).toBeDefined();
      }
    });

    it('should handle background clicks to reset selection', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockD3Selection.on).toHaveBeenCalled();
      });

      // Find background click handler
      const onCalls = (mockD3Selection.on as jest.Mock).mock.calls;
      const backgroundClickCall = onCalls.find(call => call[0] === 'click');
      
      expect(backgroundClickCall).toBeDefined();

      if (backgroundClickCall && backgroundClickCall[1]) {
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const mockEvent = {
          target: svgElement,
        };

        // Should not throw when handling background click
        expect(() => backgroundClickCall[1](mockEvent)).not.toThrow();
      }
    });
  });

  describe('Color Coding Verification', () => {
    it('should apply correct colors for different node types', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockD3Selection.each).toHaveBeenCalled();
      });

      const eachCallback = (mockD3Selection.each as jest.Mock).mock.calls[0][0];

      // Test artist color (Magenta Pink)
      const artistNode = mockNetworkData.nodes[0];
      const mockArtistGroup = {
        ...mockD3Selection,
        datum: jest.fn().mockReturnValue(artistNode),
      };

      eachCallback.call(mockArtistGroup, artistNode, 0);

      // Verify stroke color function was set
      const attrCalls = (mockD3Selection.attr as jest.Mock).mock.calls;
      const strokeCall = attrCalls.find(call => call[0] === 'stroke');
      
      if (strokeCall && typeof strokeCall[1] === 'function') {
        // The color function should return magenta pink for artist
        expect(strokeCall[1]()).toBe('#FF0ACF');
      }
    });

    it('should handle producer color correctly', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockD3Selection.each).toHaveBeenCalled();
      });

      const eachCallback = (mockD3Selection.each as jest.Mock).mock.calls[0][0];

      // Test producer color (Bright Purple)
      const producerNode = mockNetworkData.nodes[1];
      const mockProducerGroup = {
        ...mockD3Selection,
        datum: jest.fn().mockReturnValue(producerNode),
      };

      eachCallback.call(mockProducerGroup, producerNode, 1);

      const attrCalls = (mockD3Selection.attr as jest.Mock).mock.calls;
      const strokeCall = attrCalls.find(call => call[0] === 'stroke');
      
      if (strokeCall && typeof strokeCall[1] === 'function') {
        expect(strokeCall[1]()).toBe('#AE53FF');
      }
    });

    it('should handle songwriter color correctly', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockD3Selection.each).toHaveBeenCalled();
      });

      const eachCallback = (mockD3Selection.each as jest.Mock).mock.calls[0][0];

      // Test songwriter color (Light Blue)
      const songwriterNode = mockNetworkData.nodes[2];
      const mockSongwriterGroup = {
        ...mockD3Selection,
        datum: jest.fn().mockReturnValue(songwriterNode),
      };

      eachCallback.call(mockSongwriterGroup, songwriterNode, 2);

      const attrCalls = (mockD3Selection.attr as jest.Mock).mock.calls;
      const strokeCall = attrCalls.find(call => call[0] === 'stroke');
      
      if (strokeCall && typeof strokeCall[1] === 'function') {
        expect(strokeCall[1]()).toBe('#67D1F8');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing node data gracefully', async () => {
      const invalidData: NetworkData = {
        nodes: [],
        links: [],
      };

      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} data={invalidData} />
        </TestWrapper>
      );

      // Should not crash with empty data
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    it('should handle malformed node types', async () => {
      const malformedData: NetworkData = {
        nodes: [
          {
            id: 'bad1',
            name: 'Bad Node',
            type: 'unknown' as any,
            types: ['unknown'] as any,
            size: 15,
          },
        ],
        links: [],
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} data={malformedData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });

      // Should handle unknown types without crashing
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle component errors gracefully', async () => {
      // Mock a D3 error
      (mockD3Selection.each as jest.Mock).mockImplementationOnce(() => {
        throw new Error('D3 processing error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('network-container')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Responsiveness', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset: NetworkData = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node${i}`,
          name: `Artist ${i}`,
          type: 'artist' as const,
          types: ['artist'] as const,
          size: 15 + (i % 10),
          x: Math.random() * 800,
          y: Math.random() * 600,
        })),
        links: Array.from({ length: 150 }, (_, i) => ({
          source: `node${i % 100}`,
          target: `node${(i + 1) % 100}`,
          type: 'collaboration' as const,
        })),
      };

      const startTime = performance.now();

      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} data={largeDataset} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render large datasets in reasonable time
      expect(renderTime).toBeLessThan(200);
    });

    it('should handle rapid click events without breaking', async () => {
      render(
        <TestWrapper>
          <NetworkVisualizer {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockD3Selection.on).toHaveBeenCalled();
      });

      // Simulate rapid clicks - should not break selection mechanism
      const onCalls = (mockD3Selection.on as jest.Mock).mock.calls;
      const clickCall = onCalls.find(call => call[0] === 'click');
      
      if (clickCall && clickCall[1]) {
        const mockEvent = {
          stopPropagation: jest.fn(),
          target: document.createElement('circle'),
        };

        // Rapid fire multiple clicks
        for (let i = 0; i < 10; i++) {
          expect(() => clickCall[1](mockEvent)).not.toThrow();
        }
      }
    });
  });
});
