import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import NetworkVisualizer from "./network-visualizer";
import type { NetworkData, FilterState } from "@/types/network";

// Mocks
vi.mock("@/hooks/use-network-data");
vi.mock("@/hooks/use-config");
vi.mock("@/hooks/use-zoom", () => ({ useZoom: vi.fn(() => ({
  currentZoom: 1,
  handleZoomIn: vi.fn(),
  handleZoomOut: vi.fn(),
  handleZoomReset: vi.fn(),
  applyZoom: vi.fn(),
  applyPinchZoom: vi.fn(),
})) }));
vi.mock("@/hooks/use-touch-gestures", () => ({ useTouchGestures: vi.fn() }));
vi.mock("@/hooks/use-tooltip", () => ({ useTooltip: vi.fn(() => ({
  isTooltipVisible: false,
  currentNode: null,
  tooltipPosition: { x: 0, y: 0 },
  showTooltip: vi.fn(),
  hideTooltip: vi.fn(),
  moveTooltip: vi.fn(),
  handleNetworkAction: vi.fn(),
  handleExpandAction: vi.fn(),
  handleProfileAction: vi.fn(),
  handleCollaborationAction: vi.fn(),
})) }));
vi.mock("@/hooks/use-node-interactions", () => ({ useNodeInteractions: vi.fn(() => ({
  highlightedNode: null,
  resetNodeHighlight: vi.fn(),
  dragstarted: vi.fn(),
  dragged: vi.fn(),
  dragended: vi.fn(),
})) }));
vi.mock("@/hooks/use-modals", () => ({ useModals: vi.fn(() => ({
  showArtistModal: false,
  showCollaborationPopup: false,
  selectedArtistName: "",
  collaborationArtist: "",
  collaborationCollaborator: "",
  mainArtistName: "",
  openArtistModal: vi.fn(),
  closeArtistModal: vi.fn(),
  openCollaborationPopup: vi.fn(),
  closeCollaborationPopup: vi.fn(),
  handleArtistSelection: vi.fn(),
})) }));
vi.mock("@/hooks/use-filter-visibility", () => ({ useFilterVisibility: vi.fn(() => ({
  isNodeVisible: vi.fn().mockReturnValue(true),
})) }));

// Mock profile pictures hook to capture immediate batch call and inject image URLs
const updateNodesWithImagesMock = vi.fn(async (nodes: any[]) => {
  return nodes.map((n) => ({ ...n, imageUrl: n.type === 'artist' ? 'https://img.example.com/artist.jpg' : n.imageUrl }));
});

vi.mock("@/hooks/use-profile-pictures", () => ({
  useProfilePictures: vi.fn(() => ({
    isLoading: false,
    error: null,
    stats: null,
    fetchProfilePictures: vi.fn(),
    updateNodesWithImages: updateNodesWithImagesMock,
  })),
}));

// Mock renderer to inspect props
vi.mock("./d3-network-renderer", () => ({
  default: vi.fn(() => <div data-testid="d3-renderer" />),
}));

// Import mocked modules for configuration and data
import * as useNetworkDataModule from "@/hooks/use-network-data";
import * as useConfigModule from "@/hooks/use-config";
import MockD3NetworkRenderer from "./d3-network-renderer";

describe("NetworkVisualizer image fetching", () => {
  const baseData: NetworkData = {
    nodes: [
      { id: "artist-1", name: "Artist 1", type: "artist", size: 30, color: "#FF69B4" },
      { id: "producer-1", name: "Producer 1", type: "producer", size: 20, color: "#8A2BE2" },
    ],
    links: [ { source: "artist-1", target: "producer-1" } ],
  } as any;

  const filterState: FilterState = { showArtists: true, showProducers: true, showSongwriters: true };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNetworkDataModule.useNetworkData).mockReturnValue({
      expandedNodes: new Set<string>(),
      fullNetworkData: null,
      isExpandedMode: false,
      rehydrateReady: true,
      mainArtistNode: baseData.nodes[0] as any,
      visibleNodes: baseData.nodes as any,
      visibleLinks: baseData.links as any,
      displayData: baseData as any,
      getFirstDegreeCollaborators: vi.fn(() => new Set<string>()),
      expandNodeNetwork: vi.fn(),
      collapseNodeNetwork: vi.fn(),
      resetToFirstDegree: vi.fn(),
      isNodeExpanded: vi.fn(() => false),
    } as any);

    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      musicNerdBaseUrl: "https://api.test",
      getFreshConfig: vi.fn(),
      isLoading: false,
      error: null,
      refreshConfig: vi.fn(),
    } as any);

    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls batch image update immediately and passes updated image URLs to renderer", async () => {
    render(
      <NetworkVisualizer
        data={baseData}
        visible={true}
        filterState={filterState}
        onZoomChange={vi.fn()}
      />
    );

    // Wait for D3 renderer to mount after initialization
    await waitFor(() => {
      expect(MockD3NetworkRenderer).toHaveBeenCalled();
    });

    // Ensure image batch update was triggered
    expect(updateNodesWithImagesMock).toHaveBeenCalledWith(expect.arrayContaining(baseData.nodes as any));

    // Verify that the renderer receives data with imageUrl set for the artist node
    const lastCall = vi.mocked(MockD3NetworkRenderer).mock.calls.at(-1)?.[0] as any;
    expect(lastCall.data.nodes.find((n: any) => n.id === 'artist-1').imageUrl).toBe('https://img.example.com/artist.jpg');
  });
});


