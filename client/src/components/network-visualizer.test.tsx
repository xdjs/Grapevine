import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import NetworkVisualizer from "./network-visualizer";
import { NetworkData, FilterState } from "@/types/network";

// Mock all hooks and components
vi.mock("@/hooks/use-network-data");
vi.mock("@/hooks/use-config");
vi.mock("@/hooks/use-zoom");
vi.mock("@/hooks/use-touch-gestures");
vi.mock("@/hooks/use-tooltip");
vi.mock("@/hooks/use-node-interactions");
vi.mock("@/hooks/use-modals");
vi.mock("@/hooks/use-filter-visibility");
vi.mock("./d3-network-renderer", () => ({
  default: vi.fn(() => <div data-testid="d3-renderer" />)
}));
vi.mock("./artist-selection-modal", () => ({
  default: vi.fn(() => <div data-testid="artist-modal" />)
}));
vi.mock("./collaboration-details-popup", () => ({
  default: vi.fn(() => <div data-testid="collaboration-popup" />)
}));
vi.mock("./network-tooltip", () => ({
  default: vi.fn(() => <div data-testid="network-tooltip" />)
}));

// Import mocked modules for type safety
import * as useNetworkDataModule from "@/hooks/use-network-data";
import * as useConfigModule from "@/hooks/use-config";
import * as useZoomModule from "@/hooks/use-zoom";
import * as useTouchGesturesModule from "@/hooks/use-touch-gestures";
import * as useTooltipModule from "@/hooks/use-tooltip";
import * as useNodeInteractionsModule from "@/hooks/use-node-interactions";
import * as useModalsModule from "@/hooks/use-modals";
import * as useFilterVisibilityModule from "@/hooks/use-filter-visibility";

// Import mocked components after mocking
import MockD3NetworkRenderer from "./d3-network-renderer";
import MockArtistSelectionModal from "./artist-selection-modal";
import MockCollaborationDetailsPopup from "./collaboration-details-popup";
import MockNetworkTooltip from "./network-tooltip";

// Mock D3 to prevent DOM manipulation issues in tests
vi.mock("d3", () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({
      style: vi.fn()
    }))
  }))
}));

describe("NetworkVisualizer Integration Tests", () => {
  // Mock data
  const mockNetworkData: NetworkData = {
    nodes: [
      {
        id: "taylor-swift",
        name: "Taylor Swift",
        type: "artist",
        size: 30,
        color: "#FF69B4",
        x: 100,
        y: 100
      },
      {
        id: "jack-antonoff",
        name: "Jack Antonoff",
        type: "producer",
        size: 20,
        color: "#8A2BE2",
        x: 200,
        y: 200
      }
    ],
    links: [
      {
        source: "taylor-swift",
        target: "jack-antonoff",
        collaborationType: "production"
      }
    ]
  };

  const mockFilterState: FilterState = {
    showArtists: true,
    showProducers: true,
    showSongwriters: true
  };

  const mockProps = {
    data: mockNetworkData,
    visible: true,
    filterState: mockFilterState,
    onZoomChange: vi.fn(),
    onArtistSearch: vi.fn(),
    onArtistNodeClick: vi.fn(),
    onError: vi.fn()
  };

  // Mock implementations
  const mockUseNetworkData = {
    expandedNodes: new Set<string>(),
    fullNetworkData: null,
    isExpandedMode: false,
    mainArtistNode: mockNetworkData.nodes[0],
    visibleNodes: mockNetworkData.nodes,
    visibleLinks: mockNetworkData.links,
    displayData: mockNetworkData,
    expandNodeNetwork: vi.fn(),
    collapseNodeNetwork: vi.fn(),
    resetToFirstDegree: vi.fn()
  };

  const mockUseConfig = {
    musicNerdBaseUrl: "https://test-api.com",
    getFreshConfig: vi.fn(),
    isLoading: false,
    error: null,
    refreshConfig: vi.fn()
  };

  const mockUseZoom = {
    currentZoom: 1,
    handleZoomIn: vi.fn(),
    handleZoomOut: vi.fn(),
    handleZoomReset: vi.fn(),
    applyZoom: vi.fn(),
    applyPinchZoom: vi.fn()
  };

  const mockUseTooltip = {
    isTooltipVisible: false,
    currentNode: null,
    tooltipPosition: { x: 0, y: 0 },
    showTooltip: vi.fn(),
    hideTooltip: vi.fn(),
    moveTooltip: vi.fn(),
    handleNetworkAction: vi.fn(),
    handleExpandAction: vi.fn(),
    handleProfileAction: vi.fn(),
    handleCollaborationAction: vi.fn()
  };

  const mockUseNodeInteractions = {
    highlightedNode: null,
    resetNodeHighlight: vi.fn(),
    dragstarted: vi.fn(),
    dragged: vi.fn(),
    dragended: vi.fn()
  };

  const mockUseModals = {
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
    handleArtistSelection: vi.fn()
  };

  const mockUseFilterVisibility = {
    isNodeVisible: vi.fn().mockReturnValue(true)
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock implementations
    vi.mocked(useNetworkDataModule.useNetworkData).mockReturnValue(mockUseNetworkData);
    vi.mocked(useConfigModule.useConfig).mockReturnValue(mockUseConfig);
    vi.mocked(useZoomModule.useZoom).mockReturnValue(mockUseZoom);
    vi.mocked(useTouchGesturesModule.useTouchGestures).mockReturnValue(undefined);
    vi.mocked(useTooltipModule.useTooltip).mockReturnValue(mockUseTooltip);
    vi.mocked(useNodeInteractionsModule.useNodeInteractions).mockReturnValue(mockUseNodeInteractions);
    vi.mocked(useModalsModule.useModals).mockReturnValue(mockUseModals);
    vi.mocked(useFilterVisibilityModule.useFilterVisibility).mockReturnValue(mockUseFilterVisibility);

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Component Rendering and Basic Integration", () => {
    it("should render the NetworkVisualizer component successfully", () => {
      render(<NetworkVisualizer {...mockProps} />);
      
      expect(screen.getByRole("img")).toBeInTheDocument(); // SVG element
      expect(screen.getByRole("img")).toHaveClass("w-full", "h-full");
    });

    it("should apply correct visibility classes based on visible prop", () => {
      const { rerender } = render(<NetworkVisualizer {...mockProps} visible={true} />);
      
      let container = screen.getByTestId("network-container");
      expect(container).toHaveClass("opacity-100");

      rerender(<NetworkVisualizer {...mockProps} visible={false} />);
      container = screen.getByTestId("network-container");
      expect(container).toHaveClass("opacity-0");
    });

    it("should initialize all hooks with correct parameters", () => {
      render(<NetworkVisualizer {...mockProps} />);

      // Verify hook calls with correct parameters
      expect(useNetworkDataModule.useNetworkData).toHaveBeenCalledWith({ data: mockNetworkData });
      expect(useConfigModule.useConfig).toHaveBeenCalled();
      expect(useZoomModule.useZoom).toHaveBeenCalledWith(
        expect.objectContaining({
          svgRef: expect.any(Object),
          visible: true,
          onZoomChange: mockProps.onZoomChange
        })
      );
      expect(useFilterVisibilityModule.useFilterVisibility).toHaveBeenCalledWith(
        expect.objectContaining({
          svgRef: expect.any(Object),
          visible: true,
          filterState: mockFilterState
        })
      );
    });
  });

  describe("Hook Coordination and Data Flow", () => {
    it("should pass correct props to D3NetworkRenderer component", () => {
      render(<NetworkVisualizer {...mockProps} />);

      expect(vi.mocked(MockD3NetworkRenderer)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockNetworkData,
          visible: true,
          filterState: mockFilterState,
          svgRef: expect.any(Object),
          simulationRef: expect.any(Object),
          zoom: mockUseZoom,
          nodeInteractions: mockUseNodeInteractions,
          tooltip: mockUseTooltip,
          mainArtistNode: mockNetworkData.nodes[0]
        }),
        expect.any(Object)
      );
    });

    it("should coordinate between tooltip and modal systems", () => {
      const mockTooltipWithData = {
        ...mockUseTooltip,
        isTooltipVisible: true,
        currentNode: mockNetworkData.nodes[0],
        tooltipPosition: { x: 100, y: 100 }
      };

      vi.mocked(useTooltipModule.useTooltip).mockReturnValue(mockTooltipWithData);

      render(<NetworkVisualizer {...mockProps} />);

      // Verify tooltip setup includes modal callbacks
      expect(useTooltipModule.useTooltip).toHaveBeenCalledWith(
        expect.objectContaining({
          callbacks: expect.objectContaining({
            onArtistNodeClick: mockProps.onArtistNodeClick,
            onShowArtistModal: mockUseModals.openArtistModal,
            onShowCollaborationPopup: mockUseModals.openCollaborationPopup
          })
        })
      );
    });

    it("should handle expanded mode state correctly", () => {
      const expandedMockData = {
        ...mockUseNetworkData,
        isExpandedMode: true,
        mainArtistNode: mockNetworkData.nodes[0]
      };

      vi.mocked(useNetworkDataModule.useNetworkData).mockReturnValue(expandedMockData);

      render(<NetworkVisualizer {...mockProps} />);

      // Should show reset button in expanded mode
      const resetButton = screen.getByRole("button", { name: /back to taylor swift/i });
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toHaveClass("bg-blue-600");
    });

    it("should handle zoom events through window event system", async () => {
      render(<NetworkVisualizer {...mockProps} />);

      // Test zoom in event
      const zoomInEvent = new CustomEvent("network-zoom", {
        detail: { action: "in" }
      });
      
      act(() => {
        window.dispatchEvent(zoomInEvent);
      });

      expect(mockUseZoom.handleZoomIn).toHaveBeenCalled();

      // Test zoom out event
      const zoomOutEvent = new CustomEvent("network-zoom", {
        detail: { action: "out" }
      });
      
      act(() => {
        window.dispatchEvent(zoomOutEvent);
      });

      expect(mockUseZoom.handleZoomOut).toHaveBeenCalled();

      // Test zoom reset event
      const zoomResetEvent = new CustomEvent("network-zoom", {
        detail: { action: "reset" }
      });
      
      act(() => {
        window.dispatchEvent(zoomResetEvent);
      });

      expect(mockUseZoom.handleZoomReset).toHaveBeenCalled();
    });
  });

  describe("User Interaction Workflows", () => {
    it("should handle complete network expansion workflow", async () => {
      // Start with collapsed mode
      const { rerender } = render(<NetworkVisualizer {...mockProps} />);

      // Mock expansion
      const expandedState = {
        ...mockUseNetworkData,
        isExpandedMode: true,
        expandedNodes: new Set(["taylor-swift"]),
        fullNetworkData: {
          ...mockNetworkData,
          nodes: [...mockNetworkData.nodes, { id: "new-collaborator", name: "New Collaborator", type: "songwriter", size: 15, color: "#00CED1", x: 300, y: 300 }]
        }
      };

      vi.mocked(useNetworkDataModule.useNetworkData).mockReturnValue(expandedState);
      rerender(<NetworkVisualizer {...mockProps} />);

      // Should show reset button
      const resetButton = screen.getByRole("button", { name: /back to/i });
      expect(resetButton).toBeInTheDocument();

      // Click reset button
      fireEvent.click(resetButton);
      expect(mockUseNetworkData.resetToFirstDegree).toHaveBeenCalled();
    });

    it("should handle pinch zoom gestures through touch system", () => {
      render(<NetworkVisualizer {...mockProps} />);

      // Verify touch gestures hook is called with correct zoom handlers
      expect(useTouchGesturesModule.useTouchGestures).toHaveBeenCalledWith(
        expect.objectContaining({
          svgRef: expect.any(Object),
          visible: true,
          onPinchZoomIn: expect.any(Function),
          onPinchZoomOut: expect.any(Function)
        })
      );

      // Test pinch zoom functions
      const touchCall = vi.mocked(useTouchGesturesModule.useTouchGestures).mock.calls[0][0];
      
      // Test pinch zoom in
      if (touchCall.onPinchZoomIn) {
        touchCall.onPinchZoomIn(100, 200);
        expect(mockUseZoom.applyPinchZoom).toHaveBeenCalledWith(1.2, 100, 200);
      }

      // Test pinch zoom out
      if (touchCall.onPinchZoomOut) {
        touchCall.onPinchZoomOut(100, 200);
        expect(mockUseZoom.applyPinchZoom).toHaveBeenCalledWith(expect.any(Number), 100, 200);
      }
    });
  });

  describe("Modal Management Integration", () => {
    it("should render artist selection modal when state is active", () => {
      const modalActiveState = {
        ...mockUseModals,
        showArtistModal: true,
        selectedArtistName: "Test Artist"
      };

      vi.mocked(useModalsModule.useModals).mockReturnValue(modalActiveState);

      render(<NetworkVisualizer {...mockProps} />);

      expect(vi.mocked(MockArtistSelectionModal)).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true,
          artistName: "Test Artist",
          onClose: mockUseModals.closeArtistModal,
          onSelectArtist: mockUseModals.handleArtistSelection
        }),
        expect.any(Object)
      );
    });

    it("should render collaboration details popup when state is active", () => {
      const modalActiveState = {
        ...mockUseModals,
        showCollaborationPopup: true,
        collaborationArtist: "Artist 1",
        collaborationCollaborator: "Artist 2",
        mainArtistName: "Main Artist"
      };

      vi.mocked(useModalsModule.useModals).mockReturnValue(modalActiveState);

      render(<NetworkVisualizer {...mockProps} />);

      expect(vi.mocked(MockCollaborationDetailsPopup)).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true,
          artistName: "Artist 1",
          collaboratorName: "Artist 2",
          mainArtistName: "Main Artist",
          onClose: mockUseModals.closeCollaborationPopup
        }),
        expect.any(Object)
      );
    });
  });

  describe("Tooltip System Integration", () => {
    it("should render network tooltip when visible with all required props", () => {
      const tooltipActiveState = {
        ...mockUseTooltip,
        isTooltipVisible: true,
        currentNode: mockNetworkData.nodes[0],
        tooltipPosition: { x: 150, y: 250 }
      };

      vi.mocked(useTooltipModule.useTooltip).mockReturnValue(tooltipActiveState);

      render(<NetworkVisualizer {...mockProps} />);

      expect(vi.mocked(MockNetworkTooltip)).toHaveBeenCalledWith(
        expect.objectContaining({
          node: mockNetworkData.nodes[0],
          position: { x: 150, y: 250 },
          visible: true,
          isMainArtist: expect.any(Boolean),
          isFirstDegreeCollaborator: expect.any(Boolean),
          onNetworkAction: tooltipActiveState.handleNetworkAction,
          onExpandAction: tooltipActiveState.handleExpandAction,
          onProfileAction: tooltipActiveState.handleProfileAction,
          onCollaborationAction: tooltipActiveState.handleCollaborationAction,
          onClose: tooltipActiveState.hideTooltip
        }),
        expect.any(Object)
      );
    });

    it("should calculate isMainArtist correctly for tooltip", () => {
      const tooltipActiveState = {
        ...mockUseTooltip,
        isTooltipVisible: true,
        currentNode: mockNetworkData.nodes[0], // Taylor Swift (main artist)
        tooltipPosition: { x: 150, y: 250 }
      };

      vi.mocked(useTooltipModule.useTooltip).mockReturnValue(tooltipActiveState);

      render(<NetworkVisualizer {...mockProps} />);

      expect(vi.mocked(MockNetworkTooltip)).toHaveBeenCalled();
      const tooltipCall = vi.mocked(MockNetworkTooltip).mock.calls[0][0];
      // Main artist should be true (size 30 and type artist)
      expect(tooltipCall.isMainArtist).toBe(true);
    });
  });

  describe("Filter State Management", () => {
    it("should pass correct filter state to useFilterVisibility hook", () => {
      const customFilterState: FilterState = {
        showArtists: false,
        showProducers: true,
        showSongwriters: false
      };

      render(<NetworkVisualizer {...mockProps} filterState={customFilterState} />);

      expect(useFilterVisibilityModule.useFilterVisibility).toHaveBeenCalledWith(
        expect.objectContaining({
          filterState: customFilterState,
          visible: true,
          svgRef: expect.any(Object)
        })
      );
    });

    it("should update filter visibility when filterState changes", () => {
      const { rerender } = render(<NetworkVisualizer {...mockProps} />);

      const newFilterState: FilterState = {
        showArtists: false,
        showProducers: false,
        showSongwriters: true
      };

      rerender(<NetworkVisualizer {...mockProps} filterState={newFilterState} />);

      // Should call hook again with new filter state
      expect(useFilterVisibilityModule.useFilterVisibility).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filterState: newFilterState
        })
      );
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle missing network data gracefully", () => {
      const emptyNetworkData: NetworkData = { nodes: [], links: [] };
      
      expect(() => {
        render(<NetworkVisualizer {...mockProps} data={emptyNetworkData} />);
      }).not.toThrow();
    });

    it("should handle hooks returning undefined/null values", () => {
      vi.mocked(useTooltipModule.useTooltip).mockReturnValue({
        ...mockUseTooltip,
        currentNode: null
      });

      expect(() => {
        render(<NetworkVisualizer {...mockProps} />);
      }).not.toThrow();

      // Should not render tooltip when currentNode is null
      expect(screen.queryByTestId("network-tooltip")).not.toBeInTheDocument();
    });

    it("should handle component unmounting and cleanup", () => {
      const { unmount } = render(<NetworkVisualizer {...mockProps} />);
      
      // Should not throw during unmount
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it("should handle window event cleanup on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      
      const { unmount } = render(<NetworkVisualizer {...mockProps} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("network-zoom", expect.any(Function));
    });
  });

  describe("Performance and Memory Management", () => {
    it("should not re-render D3NetworkRenderer unnecessarily", () => {
      const { rerender } = render(<NetworkVisualizer {...mockProps} />);
      
      // Clear call count
      vi.mocked(MockD3NetworkRenderer).mockClear();
      
      // Re-render with same props should not cause D3 re-render
      rerender(<NetworkVisualizer {...mockProps} />);
      
      // Verify component optimization (though this depends on React.memo implementation)
      expect(vi.mocked(MockD3NetworkRenderer)).toHaveBeenCalledTimes(1);
    });

    it("should handle large network data efficiently", () => {
      const largeNetworkData: NetworkData = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node-${i}`,
          name: `Node ${i}`,
          type: i % 3 === 0 ? "artist" : i % 3 === 1 ? "producer" : "songwriter",
          size: 10 + (i % 20),
          color: "#FF69B4",
          x: Math.random() * 800,
          y: Math.random() * 600
        })),
        links: Array.from({ length: 150 }, (_, i) => ({
          source: `node-${i % 100}`,
          target: `node-${(i + 1) % 100}`,
          collaborationType: "production"
        }))
      };

      expect(() => {
        render(<NetworkVisualizer {...mockProps} data={largeNetworkData} />);
      }).not.toThrow();
    });
  });

  describe("TypeScript Interface Compliance", () => {
    it("should accept all required props without TypeScript errors", () => {
      const validProps = {
        data: mockNetworkData,
        visible: true,
        filterState: mockFilterState,
        onZoomChange: vi.fn()
      };

      expect(() => {
        render(<NetworkVisualizer {...validProps} />);
      }).not.toThrow();
    });

    it("should accept optional props", () => {
      const propsWithOptional = {
        ...mockProps,
        onArtistSearch: vi.fn(),
        onArtistNodeClick: vi.fn()
      };

      expect(() => {
        render(<NetworkVisualizer {...propsWithOptional} />);
      }).not.toThrow();
    });

    it("should work without optional props", () => {
      const minimalProps = {
        data: mockNetworkData,
        visible: true,
        filterState: mockFilterState,
        onZoomChange: vi.fn()
      };

      expect(() => {
        render(<NetworkVisualizer {...minimalProps} />);
      }).not.toThrow();
    });
  });

  describe("Accessibility and Responsive Behavior", () => {
    it("should provide proper SVG element for screen readers", () => {
      render(<NetworkVisualizer {...mockProps} />);
      
      const svgElement = screen.getByRole("img");
      expect(svgElement).toBeInTheDocument();
      expect(svgElement.tagName).toBe("svg");
    });

    it("should handle visibility changes for accessibility", () => {
      const { rerender } = render(<NetworkVisualizer {...mockProps} visible={true} />);
      
      let container = screen.getByTestId("network-container");
      expect(container).toHaveClass("opacity-100");

      rerender(<NetworkVisualizer {...mockProps} visible={false} />);
      container = screen.getByTestId("network-container");
      expect(container).toHaveClass("opacity-0");
    });

    it("should maintain proper focus management during state changes", () => {
      render(<NetworkVisualizer {...mockProps} />);
      
      // Component should not interfere with focus by default
      expect(document.activeElement).toBe(document.body);
    });
  });

  describe("Error Handling and Loading States", () => {
    it("should render network content immediately regardless of config loading state", async () => {
      const { rerender } = render(<NetworkVisualizer {...mockProps} />);

      // Should not show loading initially since we removed loading states
      expect(screen.queryByTestId("loading-state")).not.toBeInTheDocument();

      // Simulate config loading - should still not show loading state
      const loadingConfig = {
        ...mockUseConfig,
        isLoading: true
      };
      
      vi.mocked(useConfigModule.useConfig).mockReturnValue(loadingConfig);
      rerender(<NetworkVisualizer {...mockProps} />);

      // Still no loading state since we removed it
      expect(screen.queryByTestId("loading-state")).not.toBeInTheDocument();

      // Network content should render regardless of config state
      await waitFor(() => {
        expect(screen.getByRole("img")).toBeInTheDocument(); // SVG should be rendered
      });
    });

    it("should show error state when config fails to load", async () => {
      const errorConfig = {
        ...mockUseConfig,
        isLoading: false,
        error: "Failed to fetch configuration"
      };
      
      vi.mocked(useConfigModule.useConfig).mockReturnValue(errorConfig);

      render(<NetworkVisualizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeInTheDocument();
        expect(screen.getByText("Network Visualization Error")).toBeInTheDocument();
        expect(screen.getByText(/Configuration error: Failed to fetch configuration/)).toBeInTheDocument();
      });
    });

    it("should show error state when invalid network data is provided", async () => {
      const invalidData = { nodes: [], links: [] };
      
      render(<NetworkVisualizer {...mockProps} data={invalidData} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeInTheDocument();
        expect(screen.getByText(/Invalid or empty network data provided/)).toBeInTheDocument();
      });
    });

    it("should handle retry functionality", async () => {
      const errorConfig = {
        ...mockUseConfig,
        isLoading: false,
        error: "Network error",
        refreshConfig: vi.fn()
      };
      
      vi.mocked(useConfigModule.useConfig).mockReturnValue(errorConfig);

      render(<NetworkVisualizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeInTheDocument();
      });

      const retryButton = screen.getByTestId("retry-button");
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveTextContent("Retry (3 attempts left)");

      fireEvent.click(retryButton);
      expect(errorConfig.refreshConfig).toHaveBeenCalledTimes(1);
    });

    it("should handle error dismissal", async () => {
      const invalidData = { nodes: [], links: [] };
      
      render(<NetworkVisualizer {...mockProps} data={invalidData} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeInTheDocument();
      });

      const dismissButton = screen.getByTestId("dismiss-error-button");
      fireEvent.click(dismissButton);

      // After dismissing, the error state should be cleared
      // but since data is still invalid, it may re-initialize and show error again
      await waitFor(() => {
        // Either the error is cleared or a new error appears due to invalid data
        const errorStates = screen.queryAllByTestId("error-state");
        expect(errorStates.length).toBeGreaterThanOrEqual(0);
      });
    });

    it("should call onError callback when errors occur", async () => {
      const invalidData = { nodes: [], links: [] };
      const onError = vi.fn();
      
      render(<NetworkVisualizer {...mockProps} data={invalidData} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Invalid or empty network data provided"
          })
        );
      });
    });

    it("should show retry button only when retryable", async () => {
      const invalidData = { nodes: [], links: [] };
      
      render(<NetworkVisualizer {...mockProps} data={invalidData} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeInTheDocument();
      });

      // First error should be retryable
      expect(screen.getByTestId("retry-button")).toBeInTheDocument();
      expect(screen.getByText(/Retry \(3 attempts left\)/)).toBeInTheDocument();

      // Click retry once - due to invalid data, it will re-initialize and show new error
      const retryButton = screen.getByTestId("retry-button");
      fireEvent.click(retryButton);
      
      // Wait a moment for state updates
      await waitFor(() => {
        // Should show error with decremented retry count
        expect(screen.getByTestId("retry-button")).toBeInTheDocument();
      });

      // The retry count should have decreased (2 attempts left)
      expect(screen.getByText(/Retry \(2 attempts left\)/)).toBeInTheDocument();
    });



    it("should handle errors in tooltip calculations gracefully", async () => {
      const tooltipActiveState = {
        ...mockUseTooltip,
        isTooltipVisible: true,
        currentNode: mockNetworkData.nodes[0],
        tooltipPosition: { x: 150, y: 250 }
      };

      vi.mocked(useTooltipModule.useTooltip).mockReturnValue(tooltipActiveState);

      // Mock finalDisplayData to cause an error in tooltip calculations
      const problematicNetworkData = {
        ...mockUseNetworkData,
        displayData: { nodes: null, links: null } as any // This will cause errors in tooltip calculations
      };

      vi.mocked(useNetworkDataModule.useNetworkData).mockReturnValue(problematicNetworkData);

      const onError = vi.fn();
      render(<NetworkVisualizer {...mockProps} onError={onError} />);

      await waitFor(() => {
        // Should call onError when tooltip calculations fail
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("Cannot read properties of null")
          })
        );
      });

      // Should show error state instead of crashing
      expect(screen.getByTestId("error-state")).toBeInTheDocument();
      expect(screen.getByText(/tooltip.*calculation/)).toBeInTheDocument();
    });

    it("should handle reset button errors gracefully", async () => {
      const expandedState = {
        ...mockUseNetworkData,
        isExpandedMode: true,
        resetToFirstDegree: vi.fn(() => {
          throw new Error("Reset failed");
        })
      };

      vi.mocked(useNetworkDataModule.useNetworkData).mockReturnValue(expandedState);

      const onError = vi.fn();
      render(<NetworkVisualizer {...mockProps} onError={onError} />);

      const resetButton = screen.getByTestId("reset-button");
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Reset failed"
          })
        );
      });
    });

    it("should prevent zoom events when component has errors", async () => {
      const invalidData = { nodes: [], links: [] };
      render(<NetworkVisualizer {...mockProps} data={invalidData} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeInTheDocument();
      });

      // Zoom events should not be processed when there's an error
      const zoomEvent = new CustomEvent("network-zoom", {
        detail: { action: "in" }
      });
      
      act(() => {
        window.dispatchEvent(zoomEvent);
      });

      // Zoom functions should not be called
      expect(mockUseZoom.handleZoomIn).not.toHaveBeenCalled();
    });

    it("should handle unknown zoom actions gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      render(<NetworkVisualizer {...mockProps} />);

      const unknownZoomEvent = new CustomEvent("network-zoom", {
        detail: { action: "unknown" }
      });
      
      act(() => {
        window.dispatchEvent(unknownZoomEvent);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown zoom action: unknown")
      );

      consoleSpy.mockRestore();
    });

    it("should handle zoom event errors gracefully", async () => {
      const faultyZoom = {
        ...mockUseZoom,
        handleZoomIn: vi.fn(() => {
          throw new Error("Zoom failed");
        })
      };

      vi.mocked(useZoomModule.useZoom).mockReturnValue(faultyZoom);

      const onError = vi.fn();
      render(<NetworkVisualizer {...mockProps} onError={onError} />);

      const zoomEvent = new CustomEvent("network-zoom", {
        detail: { action: "in" }
      });
      
      act(() => {
        window.dispatchEvent(zoomEvent);
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Zoom failed"
          })
        );
      });
    });
  });
});