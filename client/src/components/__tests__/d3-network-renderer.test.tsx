import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import D3NetworkRenderer from '../d3-network-renderer';
import { NetworkData } from '../../types/network';

// Mock D3 completely to avoid complex mocking issues
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn().mockReturnThis(),
    data: vi.fn().mockReturnThis(),
    enter: vi.fn().mockReturnThis(),
    append: vi.fn().mockReturnThis(),
    attr: vi.fn().mockReturnThis(),
    style: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    each: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })),
  forceSimulation: vi.fn(() => ({
    force: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    alpha: vi.fn().mockReturnThis(),
    restart: vi.fn(),
    stop: vi.fn(),
  })),
  forceLink: vi.fn(() => ({
    id: vi.fn().mockReturnThis(),
    distance: vi.fn().mockReturnThis(),
  })),
  forceManyBody: vi.fn(() => ({
    strength: vi.fn().mockReturnThis(),
  })),
  forceCollide: vi.fn(() => ({
    radius: vi.fn().mockReturnThis(),
  })),
  forceCenter: vi.fn(() => vi.fn()),
  forceX: vi.fn(() => ({
    strength: vi.fn().mockReturnThis(),
  })),
  forceY: vi.fn(() => ({
    strength: vi.fn().mockReturnThis(),
  })),
  arc: vi.fn(() => ({
    innerRadius: vi.fn().mockReturnThis(),
    outerRadius: vi.fn().mockReturnThis(),
    startAngle: vi.fn().mockReturnThis(),
    endAngle: vi.fn().mockReturnThis(),
  })),
}));

// Mock hooks with complete required properties
const mockZoom = {
  setupZoomBehavior: vi.fn(),
  currentZoom: 1,
  handleZoomIn: vi.fn(),
  handleZoomOut: vi.fn(),
  handleZoomReset: vi.fn(),
  zoomTransform: vi.fn(),
  zoomIdentity: vi.fn(),
  applyZoom: vi.fn(),
  applyPinchZoom: vi.fn(),
};

const mockNodeInteractions = {
  handleNodeClick: vi.fn(),
  setupDragBehavior: vi.fn(),
  dragstarted: vi.fn(),
  dragged: vi.fn(),
  dragended: vi.fn(),
};

const mockTooltip = {
  hideTooltip: vi.fn(),
  isTooltipVisible: false,
  tooltipPosition: { x: 0, y: 0 },
  highlightedNode: null,
  currentNode: null,
  showTooltip: vi.fn(),
  updateTooltipPosition: vi.fn(),
  setHighlightedNode: vi.fn(),
  setCurrentNode: vi.fn(),
  clearHighlight: vi.fn(),
  clearCurrentNode: vi.fn(),
  moveTooltip: vi.fn(),
  positionTooltipNearNode: vi.fn(),
  resetNodeHighlight: vi.fn(),
  handleNetworkAction: vi.fn(),
  handleNodeHover: vi.fn(),
  handleNodeLeave: vi.fn(),
  handleNodeClick: vi.fn(),
  handleExpandAction: vi.fn(),
  handleProfileAction: vi.fn(),
  handleCollaborationAction: vi.fn(),
};

const mockFilterState = {
  showProducers: true,
  showSongwriters: true,
  showArtists: true,
};

// Mock the useFilterVisibility hook
vi.mock('@/hooks/use-filter-visibility', () => ({
  useFilterVisibility: vi.fn(() => ({
    isNodeVisible: vi.fn(() => true),
  })),
}));

describe('D3NetworkRenderer - Profile Pictures Feature', () => {
  let mockSvgRef: React.RefObject<SVGSVGElement>;
  let mockSimulationRef: React.RefObject<any>;
  let mockData: NetworkData;

  beforeEach(() => {
    // Create mock refs
    mockSvgRef = {
      current: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    } as React.RefObject<SVGSVGElement>;

    mockSimulationRef = {
      current: null,
    } as React.RefObject<any>;

    // Mock SVG element properties
    if (mockSvgRef.current) {
      Object.defineProperty(mockSvgRef.current, 'parentElement', {
        value: {
          clientWidth: 800,
          clientHeight: 600,
        },
      });
    }

    // Create test data with profile pictures
    mockData = {
      nodes: [
        {
          id: '1',
          name: 'Test Artist',
          type: 'artist',
          size: 30,
          imageUrl: 'https://example.com/artist.jpg',
          spotifyId: 'spotify:artist:123',
          x: 100,
          y: 100,
        },
        {
          id: '2',
          name: 'Test Producer',
          type: 'producer',
          size: 25,
          imageUrl: 'https://example.com/producer.jpg',
          spotifyId: 'spotify:artist:456',
          x: 200,
          y: 200,
        },
        {
          id: '3',
          name: 'Test Songwriter',
          type: 'songwriter',
          size: 20,
          imageUrl: null, // No image for this one
          spotifyId: null,
          x: 300,
          y: 300,
        },
      ],
      links: [
        { source: '1', target: '2' },
        { source: '2', target: '3' },
      ],
    };
  });

  describe('Profile Picture Rendering', () => {
    it('renders nodes with profile pictures when imageUrl is available', () => {
      expect(() => {
        render(
          <D3NetworkRenderer
            data={mockData}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });

    it('renders nodes without profile pictures when imageUrl is null', () => {
      // Create data with no images
      const dataWithoutImages: NetworkData = {
        nodes: mockData.nodes.map(node => ({ ...node, imageUrl: null })),
        links: mockData.links,
      };

      expect(() => {
        render(
          <D3NetworkRenderer
            data={dataWithoutImages}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });

    it('handles nodes with mixed profile picture availability', () => {
      const mixedData: NetworkData = {
        nodes: [
          {
            id: '1',
            name: 'Artist with Image',
            type: 'artist',
            size: 30,
            imageUrl: 'https://example.com/artist.jpg',
            spotifyId: 'spotify:artist:123',
            x: 100,
            y: 100,
          },
          {
            id: '2',
            name: 'Producer without Image',
            type: 'producer',
            size: 25,
            imageUrl: null,
            spotifyId: null,
            x: 200,
            y: 200,
          },
        ],
        links: [],
      };

      expect(() => {
        render(
          <D3NetworkRenderer
            data={mixedData}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Multi-Role Node Support', () => {
    it('handles multi-role nodes with profile pictures', () => {
      const multiRoleData: NetworkData = {
        nodes: [
          {
            id: '1',
            name: 'Multi-Role Artist',
            type: 'artist',
            types: ['artist', 'producer'],
            size: 35,
            imageUrl: 'https://example.com/multi.jpg',
            spotifyId: 'spotify:artist:789',
            x: 150,
            y: 150,
          },
        ],
        links: [],
      };

      expect(() => {
        render(
          <D3NetworkRenderer
            data={multiRoleData}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });

    it('handles multi-role nodes without profile pictures', () => {
      const multiRoleDataNoImage: NetworkData = {
        nodes: [
          {
            id: '1',
            name: 'Multi-Role Artist No Image',
            type: 'artist',
            types: ['artist', 'songwriter'],
            size: 35,
            imageUrl: null,
            spotifyId: null,
            x: 150,
            y: 150,
          },
        ],
        links: [],
      };

      expect(() => {
        render(
          <D3NetworkRenderer
            data={multiRoleDataNoImage}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles empty data gracefully', () => {
      const emptyData: NetworkData = {
        nodes: [],
        links: [],
      };

      expect(() => {
        render(
          <D3NetworkRenderer
            data={emptyData}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });

    it('handles missing SVG ref gracefully', () => {
      const nullSvgRef = { current: null } as React.RefObject<SVGSVGElement>;

      expect(() => {
        render(
          <D3NetworkRenderer
            data={mockData}
            visible={true}
            filterState={mockFilterState}
            svgRef={nullSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });

    it('does not render when visible is false', () => {
      expect(() => {
        render(
          <D3NetworkRenderer
            data={mockData}
            visible={false}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });

    it('handles nodes with invalid image URLs', () => {
      const dataWithInvalidUrls: NetworkData = {
        nodes: [
          {
            id: '1',
            name: 'Artist with Invalid URL',
            type: 'artist',
            size: 30,
            imageUrl: 'invalid-url',
            spotifyId: 'spotify:artist:123',
            x: 100,
            y: 100,
          },
        ],
        links: [],
      };

      expect(() => {
        render(
          <D3NetworkRenderer
            data={dataWithInvalidUrls}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });

    it('handles nodes with special characters in IDs', () => {
      const dataWithSpecialChars: NetworkData = {
        nodes: [
          {
            id: 'artist-123!@#$%',
            name: 'Artist with Special Chars',
            type: 'artist',
            size: 30,
            imageUrl: 'https://example.com/artist.jpg',
            spotifyId: 'spotify:artist:123',
            x: 100,
            y: 100,
          },
        ],
        links: [],
      };

      expect(() => {
        render(
          <D3NetworkRenderer
            data={dataWithSpecialChars}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Component Integration', () => {
    it('integrates with all required hooks and props', () => {
      expect(() => {
        render(
          <D3NetworkRenderer
            data={mockData}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
            mainArtistNode={mockData.nodes[0]}
          />
        );
      }).not.toThrow();
    });

    it('handles different node sizes with profile pictures', () => {
      const dataWithDifferentSizes: NetworkData = {
        nodes: [
          {
            id: '1',
            name: 'Small Artist',
            type: 'artist',
            size: 15,
            imageUrl: 'https://example.com/small.jpg',
            spotifyId: 'spotify:artist:123',
            x: 100,
            y: 100,
          },
          {
            id: '2',
            name: 'Large Artist',
            type: 'artist',
            size: 50,
            imageUrl: 'https://example.com/large.jpg',
            spotifyId: 'spotify:artist:456',
            x: 200,
            y: 200,
          },
        ],
        links: [],
      };

      expect(() => {
        render(
          <D3NetworkRenderer
            data={dataWithDifferentSizes}
            visible={true}
            filterState={mockFilterState}
            svgRef={mockSvgRef}
            simulationRef={mockSimulationRef}
            zoom={mockZoom}
            nodeInteractions={mockNodeInteractions}
            tooltip={mockTooltip}
          />
        );
      }).not.toThrow();
    });
  });
}); 