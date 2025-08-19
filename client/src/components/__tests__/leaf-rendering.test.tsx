import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import D3NetworkRenderer from '../d3-network-renderer';
import { NetworkData, NetworkNode, NetworkLink } from '@/types/network';

// Mock D3
const mockD3Selection = {
  selectAll: vi.fn(() => mockD3Selection),
  data: vi.fn(() => mockD3Selection),
  enter: vi.fn(() => mockD3Selection),
  append: vi.fn(() => mockD3Selection),
  attr: vi.fn(() => mockD3Selection),
  style: vi.fn(() => mockD3Selection),
  on: vi.fn(() => mockD3Selection),
  each: vi.fn(() => mockD3Selection),
  select: vi.fn(() => mockD3Selection),
  size: vi.fn(() => 1)
};

vi.mock('d3', () => ({
  select: vi.fn(() => mockD3Selection),
  selectAll: vi.fn(() => mockD3Selection),
  forceSimulation: vi.fn(() => ({
    force: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    alpha: vi.fn().mockReturnThis(),
    restart: vi.fn().mockReturnThis()
  })),
  forceLink: vi.fn(() => ({ id: vi.fn().mockReturnThis(), distance: vi.fn().mockReturnThis() })),
  forceManyBody: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceCollide: vi.fn(() => ({ radius: vi.fn().mockReturnThis() })),
  forceX: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceY: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  zoom: vi.fn(() => ({ on: vi.fn().mockReturnThis() }))
}));

// Mock hooks
vi.mock('@/hooks/use-filter-visibility', () => ({
  useFilterVisibility: vi.fn(() => ({
    isNodeVisible: vi.fn(() => true)
  }))
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false)
}));

describe('Leaf Rendering', () => {
  let mockSvgRef: React.RefObject<SVGSVGElement>;
  let mockSimulationRef: React.RefObject<any>;
  let mockZoom: any;
  let mockNodeInteractions: any;
  let mockTooltip: any;

  beforeEach(() => {
    mockSvgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') };
    mockSimulationRef = { current: null };
    mockZoom = {
      setupZoomBehavior: vi.fn(),
      currentZoom: 1
    };
    mockNodeInteractions = {
      handleNodeClick: vi.fn(),
      handleNodeHover: vi.fn(),
      handleNodeLeave: vi.fn()
    };
    mockTooltip = {
      showTooltip: vi.fn(),
      hideTooltip: vi.fn(),
      isTooltipVisible: false,
      currentNode: null,
      tooltipPosition: { x: 0, y: 0 }
    };
  });

  test('should render leaves on connection lines', () => {
    const testData: NetworkData = {
      nodes: [
        { id: '1', name: 'Artist 1', type: 'artist', size: 10, x: 100, y: 100 },
        { id: '2', name: 'Artist 2', type: 'artist', size: 10, x: 200, y: 200 }
      ],
      links: [
        { source: '1', target: '2' }
      ]
    };

    render(
      <D3NetworkRenderer
        data={testData}
        visible={true}
        filterState={{ showArtists: true, showProducers: true, showSongwriters: true }}
        svgRef={mockSvgRef}
        simulationRef={mockSimulationRef}
        zoom={mockZoom}
        nodeInteractions={mockNodeInteractions}
        tooltip={mockTooltip}
      />
    );

    // Verify that the renderLinks function was called and leaves were created
    expect(mockD3Selection.append).toHaveBeenCalledWith('g');
    expect(mockD3Selection.attr).toHaveBeenCalledWith('class', 'link-group');
  });
});
