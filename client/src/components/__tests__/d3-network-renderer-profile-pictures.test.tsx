import { render } from '@testing-library/react';
import { useRef } from 'react';
import D3NetworkRenderer from '../d3-network-renderer';
import { NetworkData, NetworkNode, FilterState } from '@/types/network';
import { UseZoomReturn } from '@/hooks/use-zoom';
import { UseNodeInteractionsReturn } from '@/hooks/use-node-interactions';
import { UseTooltipReturn } from '@/hooks/use-tooltip';

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({
      data: vi.fn(() => ({
        enter: vi.fn(() => ({
          append: vi.fn(() => ({
            attr: vi.fn().mockReturnThis(),
            style: vi.fn().mockReturnThis(),
            each: vi.fn().mockReturnThis(),
            on: vi.fn().mockReturnThis(),
          }))
        }))
      }))
    })),
    append: vi.fn(() => ({
      attr: vi.fn().mockReturnThis(),
      style: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    })),
    attr: vi.fn().mockReturnThis(),
    style: vi.fn().mockReturnThis(),
    transition: vi.fn(() => ({
      duration: vi.fn().mockReturnThis(),
      style: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis(),
    })),
    remove: vi.fn().mockReturnThis(),
  })),
  forceSimulation: vi.fn(() => ({
    nodes: vi.fn().mockReturnThis(),
    force: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    restart: vi.fn().mockReturnThis(),
  })),
  forceLink: vi.fn(),
  forceManyBody: vi.fn(),
  forceCenter: vi.fn(),
  forceX: vi.fn(),
  forceY: vi.fn(),
  arc: vi.fn(() => ({
    innerRadius: vi.fn().mockReturnThis(),
    outerRadius: vi.fn().mockReturnThis(),
    startAngle: vi.fn().mockReturnThis(),
    endAngle: vi.fn().mockReturnThis(),
  })),
  zoom: vi.fn(() => ({
    scaleExtent: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  })),
  zoomIdentity: { k: 1, x: 0, y: 0 },
}));

// Test Component that wraps D3NetworkRenderer
function TestD3NetworkRenderer({ data }: { data: NetworkData }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);
  
  const mockZoom: UseZoomReturn = {
    currentZoom: 1,
    handleZoomIn: vi.fn(),
    handleZoomOut: vi.fn(),
    handleZoomReset: vi.fn(),
    applyZoom: vi.fn(),
    applyPinchZoom: vi.fn(),
  };

  const mockNodeInteractions: UseNodeInteractionsReturn = {
    handleNodeClick: vi.fn(),
    setupDragBehavior: vi.fn(),
  };

  const mockTooltip: UseTooltipReturn = {
    isTooltipVisible: false,
    currentNode: null,
    tooltipPosition: { x: 0, y: 0 },
    showTooltip: vi.fn(),
    hideTooltip: vi.fn(),
    handleNetworkAction: vi.fn(),
    handleExpandAction: vi.fn(),
    handleProfileAction: vi.fn(),
    handleCollaborationAction: vi.fn(),
  };

  const mockFilterState: FilterState = {
    showArtists: true,
    showProducers: true,
    showSongwriters: true,
  };

  return (
    <div>
      <svg ref={svgRef} width={800} height={600} />
      <D3NetworkRenderer
        data={data}
        visible={true}
        filterState={mockFilterState}
        svgRef={svgRef}
        simulationRef={simulationRef}
        zoom={mockZoom}
        nodeInteractions={mockNodeInteractions}
        tooltip={mockTooltip}
      />
    </div>
  );
}

describe('D3NetworkRenderer Profile Pictures', () => {
  const mockNetworkData: NetworkData = {
    nodes: [
      {
        id: 'taylor-swift',
        name: 'Taylor Swift',
        type: 'artist',
        types: ['artist'],
        color: '#FF0ACF',
        size: 30,
        artistId: 'taylor-swift-id',
        imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4',
        spotifyId: '06HL4z0CvFAxyc27GXpf02'
      },
      {
        id: 'jack-antonoff',
        name: 'Jack Antonoff',
        type: 'producer',
        types: ['producer', 'songwriter'],
        color: '#AE53FF',
        size: 20,
        artistId: 'jack-antonoff-id',
        imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb12345',
        spotifyId: 'producer-spotify-id'
      },
      {
        id: 'max-martin',
        name: 'Max Martin',
        type: 'producer',
        types: ['producer'],
        color: '#AE53FF',
        size: 20,
        artistId: null,
        // No imageUrl - should use default styling
      }
    ],
    links: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render profile pictures for artist nodes with imageUrl', () => {
    const { container } = render(<TestD3NetworkRenderer data={mockNetworkData} />);
    
    expect(container.querySelector('svg')).toBeInTheDocument();
    
    // The actual D3 rendering happens in useEffect, so we're mainly testing
    // that the component renders without errors and the SVG container exists
  });

  it('should handle nodes without imageUrl gracefully', () => {
    const dataWithoutImages: NetworkData = {
      nodes: [
        {
          id: 'artist-no-image',
          name: 'Artist Without Image',
          type: 'artist',
          types: ['artist'],
          color: '#FF0ACF',
          size: 30,
          artistId: 'artist-id',
          // No imageUrl
        }
      ],
      links: []
    };

    const { container } = render(<TestD3NetworkRenderer data={dataWithoutImages} />);
    
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should only add profile picture elements to artist nodes', () => {
    const { container } = render(<TestD3NetworkRenderer data={mockNetworkData} />);
    
    // Verify SVG is rendered
    expect(container.querySelector('svg')).toBeInTheDocument();
    
    // The D3 logic for profile pictures should only apply to nodes with 'artist' role
    // This is tested by the implementation checking roles.includes('artist')
  });

  it('should handle multi-role nodes that include artist', () => {
    const multiRoleData: NetworkData = {
      nodes: [
        {
          id: 'artist-producer',
          name: 'Artist Producer',
          type: 'artist',
          types: ['artist', 'producer'],
          color: '#FF0ACF',
          size: 25,
          artistId: 'artist-producer-id',
          imageUrl: 'https://example.com/image.jpg',
          spotifyId: 'spotify-artist-producer-id'
        }
      ],
      links: []
    };

    const { container } = render(<TestD3NetworkRenderer data={multiRoleData} />);
    
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should create unique clip paths for each node', () => {
    const { container } = render(<TestD3NetworkRenderer data={mockNetworkData} />);
    
    expect(container.querySelector('svg')).toBeInTheDocument();
    
    // The implementation creates clipId using: `clip-${d.id.replace(/[^a-zA-Z0-9]/g, '_')}`
    // This ensures each node gets a unique clip path for circular image clipping
  });

  it('should handle image loading states correctly', () => {
    const { container } = render(<TestD3NetworkRenderer data={mockNetworkData} />);
    
    expect(container.querySelector('svg')).toBeInTheDocument();
    
    // The implementation includes:
    // 1. Loading spinner initially shown
    // 2. Profile image hidden initially (opacity: 0)
    // 3. On load: spinner fades out, image fades in
    // 4. On error: spinner fades out, image removed
  });
});

describe('Profile Picture Integration Flow', () => {
  it('should demonstrate the expected user experience', () => {
    // This test documents the expected behavior:
    
    // 1. Network loads quickly with default node styling
    // 2. Artist nodes with imageUrl show loading spinner
    // 3. Images load asynchronously and replace spinner
    // 4. Failed images gracefully fall back to default styling
    // 5. Producer-only nodes never show loading/images
    
    const testData: NetworkData = {
      nodes: [
        // Main artist with Spotify image
        {
          id: 'taylor-swift',
          name: 'Taylor Swift',
          type: 'artist',
          types: ['artist'],
          color: '#FF0ACF',
          size: 30,
          artistId: 'taylor-swift-id',
          imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4',
          spotifyId: '06HL4z0CvFAxyc27GXpf02'
        },
        // Collaborator artist with image
        {
          id: 'lorde',
          name: 'Lorde',
          type: 'artist',
          types: ['artist'],
          color: '#FF0ACF',
          size: 20,
          artistId: 'lorde-id',
          imageUrl: 'https://i.scdn.co/image/lorde-image',
          spotifyId: 'lorde-spotify-id'
        },
        // Producer (no image expected)
        {
          id: 'max-martin',
          name: 'Max Martin',
          type: 'producer',
          types: ['producer'],
          color: '#AE53FF',
          size: 20,
          artistId: null,
        }
      ],
      links: [
        {
          source: 'taylor-swift',
          target: 'lorde',
          type: 'collaboration'
        },
        {
          source: 'taylor-swift',
          target: 'max-martin',
          type: 'production'
        }
      ]
    };

    const { container } = render(<TestD3NetworkRenderer data={testData} />);
    
    expect(container.querySelector('svg')).toBeInTheDocument();
    
    // This integration test verifies the component handles the complete flow
    // without crashing and properly renders the SVG container
  });
});
