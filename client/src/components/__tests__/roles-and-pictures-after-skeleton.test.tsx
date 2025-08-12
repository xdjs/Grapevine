import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import NetworkVisualizer from '../../components/network-visualizer';
import { NetworkData, FilterState } from '@/types/network';

vi.mock('@/hooks/use-network-data', () => ({
  useNetworkData: () => ({
    expandedNodes: new Set<string>(),
    fullNetworkData: null,
    isExpandedMode: false,
    mainArtistNode: mockData.nodes[0],
    visibleNodes: mockData.nodes,
    visibleLinks: mockData.links,
    displayData: mockData,
    expandNodeNetwork: vi.fn(),
    collapseNodeNetwork: vi.fn(),
    resetToFirstDegree: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-config', () => ({ useConfig: () => ({ isLoading: false }) }));
vi.mock('@/hooks/use-zoom', () => ({ useZoom: () => ({ applyPinchZoom: vi.fn() }) }));
vi.mock('@/hooks/use-touch-gestures', () => ({ useTouchGestures: () => undefined }));
vi.mock('@/hooks/use-tooltip', () => ({ useTooltip: () => ({}) }));
vi.mock('@/hooks/use-node-interactions', () => ({ useNodeInteractions: () => ({}) }));
vi.mock('@/hooks/use-modals', () => ({ useModals: () => ({}) }));
vi.mock('@/hooks/use-filter-visibility', () => ({ useFilterVisibility: () => ({ isNodeVisible: () => true }) }));
vi.mock('../../components/d3-network-renderer', () => ({ default: () => <svg role="img" /> }));

const mockData: NetworkData = {
  nodes: [
    { id: 'A', name: 'A', type: 'artist', size: 30 },
    { id: 'B', name: 'B', type: 'artist', size: 20 },
  ],
  links: [{ source: 'A', target: 'B' }],
};

const filter: FilterState = { showArtists: true, showProducers: true, showSongwriters: true };

describe('Roles and pictures after skeleton render', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // Mock roles API
    vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/network-roles')) {
        return Promise.resolve(new Response(JSON.stringify({ roles: { A: ['artist','songwriter'], B: ['artist'] } }), { status: 200 })) as any;
      }
      if (url.includes('/api/artist-profile-pictures-batch')) {
        return Promise.resolve(new Response(JSON.stringify({
          results: [
            { artistName: 'A', imageUrl: 'https://img/A.jpg', spotifyId: 'sa', cached: true },
            { artistName: 'B', imageUrl: 'https://img/B.jpg', spotifyId: 'sb', cached: false },
          ], totalRequested: 2, totalFound: 2, totalCached: 1, processingTimeMs: 10
        }), { status: 200 })) as any;
      }
      return Promise.resolve(new Response('{}', { status: 200 })) as any;
    });
  });

  afterEach(() => {
    (global.fetch as any).mockRestore?.();
    (console.log as any).mockRestore?.();
  });

  it('fires separate roles and pictures requests immediately after render and applies results', async () => {
    const { rerender } = render(
      <NetworkVisualizer data={mockData} visible={true} filterState={filter} onZoomChange={() => {}} />
    );

    await waitFor(() => {
      // verify roles call
      expect(global.fetch).toHaveBeenCalledWith('/api/network-roles', expect.any(Object));
      // verify batch pictures call
      expect((global.fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes('/api/artist-profile-pictures-batch'))).toBe(true);
    });

    // nodes should be updated with roles
    expect(mockData.nodes[0].types).toEqual(['artist','songwriter']);
  });
});


