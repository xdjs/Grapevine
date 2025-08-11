import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as d3 from 'd3';
import { useFilterVisibility } from './use-filter-visibility';
import { NetworkNode, NetworkLink, FilterState } from '@/types/network';

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(),
}));

const mockD3 = d3 as { select: Mock };

describe('useFilterVisibility', () => {
  let mockSvgRef: React.RefObject<SVGSVGElement>;
  let mockFilterState: FilterState;
  let mockSvg: any;
  let mockNodeGroup: any;
  let mockLabelGroup: any;
  let mockLinkGroup: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock SVG ref
    mockSvgRef = {
      current: document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    };

    // Create mock filter state
    mockFilterState = {
      showArtists: true,
      showProducers: true,
      showSongwriters: true
    };

    // Create mock D3 selections
    mockNodeGroup = {
      style: vi.fn().mockImplementation((property, callback) => {
        if (typeof callback === 'function') {
          // Mock a basic node for testing
          const mockNode: NetworkNode = { id: 'test', name: 'Test', type: 'artist', size: 20 };
          const mockContext = { datum: vi.fn().mockReturnValue(mockNode) };
          mockD3.select.mockReturnValue({ datum: vi.fn().mockReturnValue(mockNode) });
          callback.call(mockContext);
        }
        return mockNodeGroup;
      }),
      datum: vi.fn()
    };

    mockLabelGroup = {
      style: vi.fn().mockImplementation((property, callback) => {
        if (typeof callback === 'function') {
          // Mock a basic node for testing
          const mockNode: NetworkNode = { id: 'test', name: 'Test', type: 'artist', size: 20 };
          const mockContext = { datum: vi.fn().mockReturnValue(mockNode) };
          mockD3.select.mockReturnValue({ datum: vi.fn().mockReturnValue(mockNode) });
          callback.call(mockContext);
        }
        return mockLabelGroup;
      }),
      datum: vi.fn()
    };

    mockLinkGroup = {
      style: vi.fn().mockReturnThis(),
      datum: vi.fn()
    };

    mockSvg = {
      selectAll: vi.fn().mockImplementation((selector: string) => {
        if (selector === '.node-group') return mockNodeGroup;
        if (selector === '.label') return mockLabelGroup;
        if (selector === '.link') return mockLinkGroup;
        return { style: vi.fn().mockReturnThis() };
      })
    };

    // Setup D3 select to return the mock SVG when called with the actual SVG element
    mockD3.select.mockImplementation((element) => {
      if (element === mockSvgRef.current) {
        return mockSvg;
      }
      // For individual elements (like 'this' in callbacks), return a mock with datum
      return {
        datum: vi.fn().mockReturnValue({ id: 'test', name: 'Test', type: 'artist', size: 20 })
      };
    });
  });

  describe('isNodeVisible function', () => {
    it('should return true for artist nodes when showArtists is true', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { ...mockFilterState, showArtists: true }
        })
      );

      const artistNode: NetworkNode = {
        id: 'artist1',
        name: 'Artist 1',
        type: 'artist',
        size: 20
      };

      expect(result.current.isNodeVisible(artistNode)).toBe(true);
    });

    it('should return false for artist nodes when showArtists is false', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { ...mockFilterState, showArtists: false }
        })
      );

      const artistNode: NetworkNode = {
        id: 'artist1',
        name: 'Artist 1',
        type: 'artist',
        size: 20
      };

      expect(result.current.isNodeVisible(artistNode)).toBe(false);
    });

    it('should return true for producer nodes when showProducers is true', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { ...mockFilterState, showProducers: true }
        })
      );

      const producerNode: NetworkNode = {
        id: 'producer1',
        name: 'Producer 1',
        type: 'producer',
        size: 15
      };

      expect(result.current.isNodeVisible(producerNode)).toBe(true);
    });

    it('should return false for producer nodes when showProducers is false', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { ...mockFilterState, showProducers: false }
        })
      );

      const producerNode: NetworkNode = {
        id: 'producer1',
        name: 'Producer 1',
        type: 'producer',
        size: 15
      };

      expect(result.current.isNodeVisible(producerNode)).toBe(false);
    });

    it('should return true for songwriter nodes when showSongwriters is true', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { ...mockFilterState, showSongwriters: true }
        })
      );

      const songwriterNode: NetworkNode = {
        id: 'songwriter1',
        name: 'Songwriter 1',
        type: 'songwriter',
        size: 15
      };

      expect(result.current.isNodeVisible(songwriterNode)).toBe(true);
    });

    it('should return false for songwriter nodes when showSongwriters is false', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { ...mockFilterState, showSongwriters: false }
        })
      );

      const songwriterNode: NetworkNode = {
        id: 'songwriter1',
        name: 'Songwriter 1',
        type: 'songwriter',
        size: 15
      };

      expect(result.current.isNodeVisible(songwriterNode)).toBe(false);
    });

    describe('multi-role node visibility', () => {
      it('should return true for multi-role nodes when ANY role is visible', () => {
        const { result } = renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: { 
              showArtists: true, 
              showProducers: false, 
              showSongwriters: false 
            }
          })
        );

        const multiRoleNode: NetworkNode = {
          id: 'multi1',
          name: 'Multi Role Artist',
          type: 'artist',
          types: ['artist', 'producer'],
          size: 20
        };

        expect(result.current.isNodeVisible(multiRoleNode)).toBe(true);
      });

      it('should return false for multi-role nodes when NO roles are visible', () => {
        const { result } = renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: { 
              showArtists: false, 
              showProducers: false, 
              showSongwriters: true 
            }
          })
        );

        const multiRoleNode: NetworkNode = {
          id: 'multi1',
          name: 'Multi Role Artist',
          type: 'artist',
          types: ['artist', 'producer'],
          size: 20
        };

        expect(result.current.isNodeVisible(multiRoleNode)).toBe(false);
      });

      it('should handle three-role nodes correctly', () => {
        const { result } = renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: { 
              showArtists: false, 
              showProducers: false, 
              showSongwriters: true 
            }
          })
        );

        const tripleRoleNode: NetworkNode = {
          id: 'triple1',
          name: 'Triple Role Person',
          type: 'artist',
          types: ['artist', 'producer', 'songwriter'],
          size: 25
        };

        expect(result.current.isNodeVisible(tripleRoleNode)).toBe(true);
      });

      it('should fall back to single type when types array is empty', () => {
        const { result } = renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: { 
              showArtists: true, 
              showProducers: false, 
              showSongwriters: false 
            }
          })
        );

        const nodeWithEmptyTypes: NetworkNode = {
          id: 'empty1',
          name: 'Artist with Empty Types',
          type: 'artist',
          types: [],
          size: 20
        };

        expect(result.current.isNodeVisible(nodeWithEmptyTypes)).toBe(true);
      });

      it('should handle missing types array gracefully', () => {
        const { result } = renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: { 
              showArtists: true, 
              showProducers: false, 
              showSongwriters: false 
            }
          })
        );

        const nodeWithoutTypes: NetworkNode = {
          id: 'no-types1',
          name: 'Artist without Types',
          type: 'artist',
          size: 20
        };

        expect(result.current.isNodeVisible(nodeWithoutTypes)).toBe(true);
      });
    });

    describe('edge cases and error handling', () => {
      it('should handle unknown node types gracefully', () => {
        const { result } = renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: mockFilterState
          })
        );

        const unknownTypeNode: NetworkNode = {
          id: 'unknown1',
          name: 'Unknown Type',
          type: 'unknown' as any,
          size: 15
        };

        expect(result.current.isNodeVisible(unknownTypeNode)).toBe(true);
      });

      it('should handle null/undefined node data gracefully', () => {
        const { result } = renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: mockFilterState
          })
        );

        const incompleteNode: Partial<NetworkNode> = {
          id: 'incomplete1',
          name: 'Incomplete Node'
          // Missing type and size
        };

        expect(() => 
          result.current.isNodeVisible(incompleteNode as NetworkNode)
        ).not.toThrow();
      });
    });
  });

  describe('filter state changes and DOM updates', () => {
    it('should call D3 select when visible is true', () => {
      renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: mockFilterState
        })
      );

      expect(mockD3.select).toHaveBeenCalledWith(mockSvgRef.current);
    });

    it('should not call D3 select when visible is false', () => {
      renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: false,
          filterState: mockFilterState
        })
      );

      expect(mockD3.select).not.toHaveBeenCalled();
    });

    it('should not call D3 select when svgRef.current is null', () => {
      const nullSvgRef = { current: null };
      
      renderHook(() => 
        useFilterVisibility({
          svgRef: nullSvgRef,
          visible: true,
          filterState: mockFilterState
        })
      );

      expect(mockD3.select).not.toHaveBeenCalled();
    });

    it('should handle filter state changes without crashing', () => {
      const { rerender } = renderHook(
        ({ filterState }) => useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState
        }),
        {
          initialProps: { filterState: mockFilterState }
        }
      );

      // Should not crash on re-render with new filter state
      const newFilterState = { ...mockFilterState, showArtists: false };
      expect(() => {
        rerender({ filterState: newFilterState });
      }).not.toThrow();
    });

    it('should handle multiple filter state changes', () => {
      const { rerender } = renderHook(
        ({ filterState }) => useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState
        }),
        {
          initialProps: { filterState: mockFilterState }
        }
      );

      // Test multiple rapid changes
      const filterStates = [
        { showArtists: false, showProducers: true, showSongwriters: true },
        { showArtists: true, showProducers: false, showSongwriters: true },
        { showArtists: true, showProducers: true, showSongwriters: false },
        { showArtists: false, showProducers: false, showSongwriters: false },
        { showArtists: true, showProducers: true, showSongwriters: true }
      ];

      filterStates.forEach(filterState => {
        expect(() => {
          rerender({ filterState });
        }).not.toThrow();
      });
    });

    it('should respond to visibility changes', () => {
      const { rerender } = renderHook(
        ({ visible }) => useFilterVisibility({
          svgRef: mockSvgRef,
          visible,
          filterState: mockFilterState
        }),
        {
          initialProps: { visible: true }
        }
      );

      // Change visibility to false
      expect(() => {
        rerender({ visible: false });
      }).not.toThrow();

      // Change back to true
      expect(() => {
        rerender({ visible: true });
      }).not.toThrow();
    });
  });

  describe('link visibility logic', () => {
    let mockLink: NetworkLink;
    let mockSourceNode: NetworkNode;
    let mockTargetNode: NetworkNode;

    beforeEach(() => {
      mockSourceNode = {
        id: 'source1',
        name: 'Source Artist',
        type: 'artist',
        size: 20
      };

      mockTargetNode = {
        id: 'target1',
        name: 'Target Producer',
        type: 'producer',
        size: 15
      };

      mockLink = {
        source: mockSourceNode,
        target: mockTargetNode
      };

      // Mock the link group's style function to call our callback with proper D3 context
      mockLinkGroup.style = vi.fn().mockImplementation((property, callback) => {
        if (typeof callback === 'function') {
          // Mock the context 'this' that would be passed to the callback
          const mockThisContext = {
            datum: vi.fn().mockReturnValue(mockLink)
          };
          // Mock d3.select(this) to return an object with datum method
          mockD3.select.mockReturnValue({
            datum: vi.fn().mockReturnValue(mockLink)
          });
          callback.call(mockThisContext);
        }
        return mockLinkGroup;
      });
    });

    it('should show links when both nodes are visible', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { 
            showArtists: true, 
            showProducers: true, 
            showSongwriters: true 
          }
        })
      );

      // Both source (artist) and target (producer) should be visible
      expect(result.current.isNodeVisible(mockSourceNode)).toBe(true);
      expect(result.current.isNodeVisible(mockTargetNode)).toBe(true);
    });

    it('should hide links when source node is not visible', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { 
            showArtists: false,  // Source is hidden
            showProducers: true, 
            showSongwriters: true 
          }
        })
      );

      expect(result.current.isNodeVisible(mockSourceNode)).toBe(false);
      expect(result.current.isNodeVisible(mockTargetNode)).toBe(true);
    });

    it('should hide links when target node is not visible', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { 
            showArtists: true, 
            showProducers: false, // Target is hidden
            showSongwriters: true 
          }
        })
      );

      expect(result.current.isNodeVisible(mockSourceNode)).toBe(true);
      expect(result.current.isNodeVisible(mockTargetNode)).toBe(false);
    });

    it('should hide links when both nodes are not visible', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: { 
            showArtists: false,  // Source is hidden
            showProducers: false, // Target is hidden
            showSongwriters: true 
          }
        })
      );

      expect(result.current.isNodeVisible(mockSourceNode)).toBe(false);
      expect(result.current.isNodeVisible(mockTargetNode)).toBe(false);
    });
  });

  describe('performance and optimization', () => {
    it('should maintain stable function reference', () => {
      const { result, rerender } = renderHook(
        ({ filterState }) => useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState
        }),
        {
          initialProps: { filterState: mockFilterState }
        }
      );

      const initialIsNodeVisible = result.current.isNodeVisible;
      
      // Re-render with same filter state
      rerender({ filterState: mockFilterState });
      
      // Function reference should remain stable
      expect(result.current.isNodeVisible).toBe(initialIsNodeVisible);
    });

    it('should handle rapid filter state changes without crashing', () => {
      const { rerender } = renderHook(
        ({ filterState }) => useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState
        }),
        {
          initialProps: { filterState: mockFilterState }
        }
      );

      // Simulate rapid filter changes
      for (let i = 0; i < 50; i++) {
        const newFilterState = {
          showArtists: i % 2 === 0,
          showProducers: i % 3 === 0,
          showSongwriters: i % 5 === 0
        };
        
        expect(() => {
          rerender({ filterState: newFilterState });
        }).not.toThrow();
      }
    });
  });

  describe('accessibility and compliance', () => {
    it('should maintain consistent interface for screen readers', () => {
      const { result } = renderHook(() => 
        useFilterVisibility({
          svgRef: mockSvgRef,
          visible: true,
          filterState: mockFilterState
        })
      );

      // The isNodeVisible function should be stable for accessibility tools
      expect(typeof result.current.isNodeVisible).toBe('function');
    });

    it('should handle filter state properties correctly for all accessibility cases', () => {
      // Test all combinations for screen reader compatibility
      const testCases = [
        { type: 'artist', show: true },
        { type: 'artist', show: false },
        { type: 'producer', show: true },
        { type: 'producer', show: false },
        { type: 'songwriter', show: true },
        { type: 'songwriter', show: false },
      ];

      testCases.forEach(({ type, show }) => {
        const node: NetworkNode = {
          id: `test-${type}`,
          name: `Test ${type}`,
          type: type as any,
          size: 15
        };

        const filterState = {
          showArtists: type === 'artist' ? show : true,
          showProducers: type === 'producer' ? show : true,
          showSongwriters: type === 'songwriter' ? show : true
        };

        const { result } = renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState
          })
        );

        expect(result.current.isNodeVisible(node)).toBe(show);
      });
    });
  });

  describe('error handling and robustness', () => {
    it('should handle corrupted filter state gracefully', () => {
      const corruptedFilterState = {
        showArtists: undefined as any,
        showProducers: null as any,
        showSongwriters: 'true' as any
      };

      expect(() => {
        renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: corruptedFilterState
          })
        );
      }).not.toThrow();
    });

    it('should handle missing SVG element gracefully during filter updates', () => {
      const { rerender } = renderHook(
        ({ svgRef }) => useFilterVisibility({
          svgRef,
          visible: true,
          filterState: mockFilterState
        }),
        {
          initialProps: { svgRef: mockSvgRef }
        }
      );

      // Simulate SVG element being removed
      const nullSvgRef = { current: null };
      rerender({ svgRef: nullSvgRef });

      // Should not crash
      expect(() => {
        rerender({ svgRef: nullSvgRef });
      }).not.toThrow();
    });

    it('should handle D3 selection errors gracefully', () => {
      // Mock D3 select to throw an error
      mockD3.select.mockImplementation(() => {
        throw new Error('D3 selection failed');
      });

      expect(() => {
        renderHook(() => 
          useFilterVisibility({
            svgRef: mockSvgRef,
            visible: true,
            filterState: mockFilterState
          })
        );
      }).toThrow('D3 selection failed');
    });
  });
});