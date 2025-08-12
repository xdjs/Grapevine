import { render, waitFor, screen, act } from '@testing-library/react';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import NetworkVisualizer from './network-visualizer';
import type { NetworkData, FilterState } from '@/types/network';

// Mock fetch globally
const originalFetch = global.fetch;

// Mock hooks and child components with minimal behavior
vi.mock('@/hooks/use-network-data', () => ({
  useNetworkData: vi.fn(({ data }: { data: NetworkData }) => ({
    expandedNodes: new Set<string>(),
    fullNetworkData: null,
    isExpandedMode: false,
    mainArtistNode: data.nodes.find(n => n.size === 30),
    visibleNodes: data.nodes,
    visibleLinks: data.links,
    displayData: data,
    getFirstDegreeCollaborators: vi.fn(() => new Set<string>()),
    expandNodeNetwork: vi.fn(),
    collapseNodeNetwork: vi.fn(),
    resetToFirstDegree: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-config', () => ({
  useConfig: vi.fn(() => ({
    musicNerdBaseUrl: 'https://test',
    getFreshConfig: vi.fn(),
    isLoading: false,
    error: null,
    refreshConfig: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-zoom', () => ({
  useZoom: vi.fn(() => ({
    currentZoom: 1,
    handleZoomIn: vi.fn(),
    handleZoomOut: vi.fn(),
    handleZoomReset: vi.fn(),
    applyZoom: vi.fn(),
    applyPinchZoom: vi.fn(),
    setupZoomBehavior: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-touch-gestures', () => ({ useTouchGestures: vi.fn(() => undefined) }));
vi.mock('@/hooks/use-tooltip', () => ({
  useTooltip: vi.fn(() => ({
    isTooltipVisible: false,
    tooltipPosition: { x: 0, y: 0 },
    highlightedNode: null,
    currentNode: null,
    showTooltip: vi.fn(),
    hideTooltip: vi.fn(),
    moveTooltip: vi.fn(),
    positionTooltipNearNode: vi.fn(),
    highlightNode: vi.fn(),
    resetNodeHighlight: vi.fn(),
    handleNetworkAction: vi.fn(),
    handleExpandAction: vi.fn(),
    handleProfileAction: vi.fn(),
    handleCollaborationAction: vi.fn(),
  })),
}));
vi.mock('@/hooks/use-node-interactions', () => ({
  useNodeInteractions: vi.fn(() => ({
    handleNodeClick: vi.fn(),
    setupDragBehavior: vi.fn(),
  })),
}));
vi.mock('@/hooks/use-modals', () => ({
  useModals: vi.fn(() => ({
    showArtistModal: false,
    showCollaborationPopup: false,
    selectedArtistName: '',
    collaborationArtist: '',
    collaborationCollaborator: '',
    mainArtistName: '',
    openArtistModal: vi.fn(),
    closeArtistModal: vi.fn(),
    openCollaborationPopup: vi.fn(),
    closeCollaborationPopup: vi.fn(),
    handleArtistSelection: vi.fn(),
  })),
}));
vi.mock('@/hooks/use-filter-visibility', () => ({ useFilterVisibility: vi.fn(() => ({ isNodeVisible: vi.fn(() => true) })) }));

vi.mock('./d3-network-renderer', () => ({ default: vi.fn(() => <div data-testid="d3-renderer" />) }));
vi.mock('./artist-selection-modal', () => ({ default: vi.fn(() => <div />) }));
vi.mock('./collaboration-details-popup', () => ({ default: vi.fn(() => <div />) }));
vi.mock('./network-tooltip', () => ({ default: vi.fn(() => <div />) }));

// Bring the mocked useNetworkData into scope for assertions
import * as useNetworkDataModule from '@/hooks/use-network-data';

describe('NetworkVisualizer roles enrichment', () => {
  const baseData: NetworkData = {
    nodes: [
      { id: 'A', name: 'Main Artist', type: 'artist', size: 30 },
      { id: 'B', name: 'Jack Antonoff', type: 'producer', size: 20 },
      { id: 'C', name: 'Aaron Dessner', type: 'producer', size: 20 },
    ],
    links: [ { source: 'A', target: 'B' }, { source: 'A', target: 'C' } ],
  };
  const filterState: FilterState = { showArtists: true, showProducers: true, showSongwriters: true };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls /api/network-roles after initial render with all node names and updates roles', async () => {
    // Mock roles API
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        roles: {
          'Main Artist': ['artist', 'songwriter'],
          'Jack Antonoff': ['artist', 'producer', 'songwriter'],
        },
      }),
    });

    render(
      <NetworkVisualizer
        data={baseData}
        visible={true}
        filterState={filterState}
        onZoomChange={() => {}}
      />
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Verify endpoint and body
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('/api/network-roles');
    const body = JSON.parse(init.body);
    expect(body.names.sort()).toEqual(['Aaron Dessner', 'Jack Antonoff', 'Main Artist'].sort());
    expect(init.signal).toBeInstanceOf(AbortSignal);

    // After roles arrive, useNetworkData should be re-invoked with enriched data
    const calls = (useNetworkDataModule.useNetworkData as any).mock.calls.map((c: any[]) => c[0].data);
    const enrichedCall = calls.find((d: NetworkData) => Array.isArray(d?.nodes?.[1]?.types));
    expect(enrichedCall).toBeTruthy();
    const jack = enrichedCall.nodes.find((n: any) => n.name === 'Jack Antonoff');
    expect(jack.types).toEqual(['artist', 'producer', 'songwriter']);
  });

  it('fails silently when roles API returns non-ok and keeps original data', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });

    render(
      <NetworkVisualizer
        data={baseData}
        visible={true}
        filterState={filterState}
        onZoomChange={() => {}}
      />
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const calls = (useNetworkDataModule.useNetworkData as any).mock.calls.map((c: any[]) => c[0].data);
    // Ensure no enriched call (types undefined on collaborator)
    const enrichedCall = calls.find((d: NetworkData) => Array.isArray(d?.nodes?.[1]?.types));
    expect(enrichedCall).toBeFalsy();
  });

  it('aborts roles request on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    (global.fetch as any).mockImplementationOnce((_url: string, init: any) => {
      capturedSignal = init.signal;
      return new Promise(() => {}); // never resolve
    });

    const { unmount } = render(
      <NetworkVisualizer
        data={baseData}
        visible={true}
        filterState={filterState}
        onZoomChange={() => {}}
      />
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal!.aborted).toBe(false);

    // Unmount triggers cleanup -> abort
    unmount();
    expect(capturedSignal!.aborted).toBe(true);
  });
});


