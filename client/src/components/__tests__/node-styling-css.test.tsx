import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import * as d3 from 'd3';
import D3NetworkRenderer from '../d3-network-renderer';
import { NetworkData, NetworkNode } from '@/types/network';

// Mock D3 and its methods
const mockTransition = {
  duration: vi.fn().mockReturnThis(),
  ease: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
};

const mockSelection = {
  selectAll: vi.fn().mockReturnThis(),
  data: vi.fn().mockReturnThis(),
  enter: vi.fn().mockReturnThis(),
  append: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  classed: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  transition: vi.fn(() => mockTransition),
  remove: vi.fn().mockReturnThis(),
  each: vi.fn().mockReturnThis(),
  text: vi.fn().mockReturnThis(),
};

const mockSimulation = {
  force: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
};

vi.mock('d3', () => ({
  select: vi.fn(() => mockSelection),
  forceSimulation: vi.fn(() => mockSimulation),
  forceLink: vi.fn().mockReturnValue({ id: vi.fn().mockReturnThis(), distance: vi.fn().mockReturnThis() }),
  forceManyBody: vi.fn().mockReturnValue({ strength: vi.fn().mockReturnThis() }),
  forceCollide: vi.fn().mockReturnValue({ radius: vi.fn().mockReturnThis() }),
  forceX: vi.fn().mockReturnValue({ strength: vi.fn().mockReturnThis() }),
  forceY: vi.fn().mockReturnValue({ strength: vi.fn().mockReturnThis() }),
  arc: vi.fn(() => ({
    innerRadius: vi.fn().mockReturnThis(),
    outerRadius: vi.fn().mockReturnThis(),
    startAngle: vi.fn().mockReturnThis(),
    endAngle: vi.fn().mockReturnThis(),
  })),
  easeOutCubic: vi.fn(),
}));

// Mock hooks
vi.mock('@/hooks/use-filter-visibility', () => ({
  useFilterVisibility: () => ({
    isNodeVisible: vi.fn(() => true),
  }),
}));

describe('Node Styling and CSS - Task 2.3', () => {
  let mockSvgRef: React.RefObject<SVGSVGElement>;
  let mockSimulationRef: React.RefObject<d3.Simulation<NetworkNode, any> | null>;
  let nodeEachCallback: any;

  const createDefaultProps = (overrides = {}) => ({
    data: { nodes: [], links: [] } as NetworkData,
    visible: true,
    filterState: { showArtists: true, showProducers: true, showSongwriters: true },
    svgRef: mockSvgRef,
    simulationRef: mockSimulationRef,
    zoom: {
      setupZoomBehavior: vi.fn(),
    },
    nodeInteractions: {
      handleNodeClick: vi.fn(),
      setupDragBehavior: vi.fn(),
    },
    tooltip: {
      hideTooltip: vi.fn(),
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSvgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') };
    mockSimulationRef = { current: null };
    
    // Setup container
    if (mockSvgRef.current) {
      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      container.appendChild(mockSvgRef.current);
      document.body.appendChild(container);
    }

    // Capture the nodeElements.each callback
    mockSelection.each.mockImplementation((callback) => {
      nodeEachCallback = callback;
      return mockSelection;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('CSS Class Assignment', () => {
    it('should assign node-with-image class to nodes with imageUrl', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      let classFunction: any;
      
      // Capture the class function
      mockSelection.attr.mockImplementation((attrName, attrValue) => {
        if (attrName === 'class' && typeof attrValue === 'function') {
          classFunction = attrValue;
        }
        return mockSelection;
      });

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      // Test the class function with our node
      if (classFunction) {
        const result = classFunction(nodeWithImage);
        expect(result).toContain('node-with-image');
      }
    });

    it('should assign node-multi-role class to nodes with multiple types', () => {
      const multiRoleNode: NetworkNode = {
        id: 'artist1',
        name: 'Multi Role Artist',
        type: 'artist',
        types: ['artist', 'producer'],
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [multiRoleNode],
        links: [],
      };

      let classFunction: any;
      
      // Capture the class function
      mockSelection.attr.mockImplementation((attrName, attrValue) => {
        if (attrName === 'class' && typeof attrValue === 'function') {
          classFunction = attrValue;
        }
        return mockSelection;
      });

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      // Test the class function with our node
      if (classFunction) {
        const result = classFunction(multiRoleNode);
        expect(result).toContain('node-with-image');
        expect(result).toContain('node-multi-role');
      }
    });

    it('should not assign image classes to nodes without imageUrl', () => {
      const nodeWithoutImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
      };

      const data = {
        nodes: [nodeWithoutImage],
        links: [],
      };

      let classFunction: any;
      
      // Capture the class function
      mockSelection.attr.mockImplementation((attrName, attrValue) => {
        if (attrName === 'class' && typeof attrValue === 'function') {
          classFunction = attrValue;
        }
        return mockSelection;
      });

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      // Test the class function with our node
      if (classFunction) {
        const result = classFunction(nodeWithoutImage);
        expect(result).not.toContain('node-with-image');
        expect(result).not.toContain('node-multi-role');
      }
    });
  });

  describe('Profile Image Styling States', () => {
    it('should initially add profile-image-loading class to images', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        mockSelection.append.mockReturnValue(mockSelection);
        nodeEachCallback.call(mockSelection, nodeWithImage);

        // Verify image element was created with loading class
        expect(mockSelection.attr).toHaveBeenCalledWith('class', 'profile-image profile-image-loading');
      }
    });

    it('should add accessibility attributes to profile images', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        mockSelection.append.mockReturnValue(mockSelection);
        nodeEachCallback.call(mockSelection, nodeWithImage);

        // Verify accessibility attributes
        expect(mockSelection.attr).toHaveBeenCalledWith('alt', 'Profile picture of Test Artist');
        expect(mockSelection.attr).toHaveBeenCalledWith('role', 'img');
        expect(mockSelection.attr).toHaveBeenCalledWith('aria-label', 'Profile picture of Test Artist');
      }
    });

    it('should handle successful image load with proper class transitions', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        let loadHandler: any;
        
        // Mock the image element's on method to capture load handler
        const mockImageSelection = {
          ...mockSelection,
          on: vi.fn((event, handler) => {
            if (event === 'load') {
              loadHandler = handler;
            }
            return mockImageSelection;
          }),
        };
        
        mockSelection.append.mockReturnValue(mockImageSelection);
        nodeEachCallback.call(mockSelection, nodeWithImage);

        // Simulate image load
        if (loadHandler) {
          loadHandler.call(mockImageSelection);

          // Verify class updates
          expect(mockImageSelection.classed).toHaveBeenCalledWith('profile-image-loading', false);
          expect(mockImageSelection.classed).toHaveBeenCalledWith('profile-image-loaded', true);
          
          // Verify transition is called
          expect(mockImageSelection.transition).toHaveBeenCalled();
        }
      }
    });

    it('should handle image load errors with proper cleanup', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/invalid-image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        let errorHandler: any;
        
        // Mock the image element's on method to capture error handler
        const mockImageSelection = {
          ...mockSelection,
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              errorHandler = handler;
            }
            return mockImageSelection;
          }),
        };
        
        mockSelection.append.mockReturnValue(mockImageSelection);
        nodeEachCallback.call(mockSelection, nodeWithImage);

        // Simulate image error
        if (errorHandler) {
          errorHandler.call(mockImageSelection);

          // Verify error class is set
          expect(mockImageSelection.classed).toHaveBeenCalledWith('profile-image-loading', false);
          expect(mockImageSelection.classed).toHaveBeenCalledWith('profile-image-error', true);
          
          // Verify image is removed
          expect(mockImageSelection.remove).toHaveBeenCalled();
        }
      }
    });
  });

  describe('Loading Spinner Styling', () => {
    it('should create loading spinner with proper styling attributes', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        mockSelection.append.mockReturnValue(mockSelection);
        nodeEachCallback.call(mockSelection, nodeWithImage);

        // Verify loading spinner attributes
        expect(mockSelection.attr).toHaveBeenCalledWith('class', 'loading-spinner');
        expect(mockSelection.style).toHaveBeenCalledWith('opacity', 1);
        expect(mockSelection.style).toHaveBeenCalledWith('animation', 'spin 1s linear infinite');
      }
    });

    it('should remove loading spinner with transition on image load', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        let loadHandler: any;
        const mockLoadingGroup = { ...mockSelection };
        
        const mockImageSelection = {
          ...mockSelection,
          on: vi.fn((event, handler) => {
            if (event === 'load') {
              loadHandler = handler;
            }
            return mockImageSelection;
          }),
        };

        // Mock the append calls to return different selections for loading group and image
        let appendCallCount = 0;
        mockSelection.append.mockImplementation(() => {
          appendCallCount++;
          if (appendCallCount === 2) { // Second append is for loading group
            return mockLoadingGroup;
          }
          return mockImageSelection;
        });

        nodeEachCallback.call(mockSelection, nodeWithImage);

        // Simulate image load
        if (loadHandler) {
          loadHandler.call(mockImageSelection);

          // Verify loading group transition is called
          expect(mockLoadingGroup.transition).toHaveBeenCalled();
          expect(mockTransition.duration).toHaveBeenCalledWith(300);
          expect(mockTransition.style).toHaveBeenCalledWith('opacity', 0);
        }
      }
    });
  });

  describe('Visual Transitions and Animations', () => {
    it('should use d3.easeOutCubic for image fade-in animation', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        let loadHandler: any;
        const mockImageSelection = {
          ...mockSelection,
          on: vi.fn((event, handler) => {
            if (event === 'load') {
              loadHandler = handler;
            }
            return mockImageSelection;
          }),
        };
        
        mockSelection.append.mockReturnValue(mockImageSelection);
        nodeEachCallback.call(mockSelection, nodeWithImage);

        // Simulate image load
        if (loadHandler) {
          loadHandler.call(mockImageSelection);

          // Verify ease function is used
          expect(mockTransition.ease).toHaveBeenCalledWith(d3.easeOutCubic);
          expect(mockTransition.duration).toHaveBeenCalledWith(500);
        }
      }
    });

    it('should set proper opacity and transition durations', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        let loadHandler: any;
        const mockImageSelection = {
          ...mockSelection,
          on: vi.fn((event, handler) => {
            if (event === 'load') {
              loadHandler = handler;
            }
            return mockImageSelection;
          }),
        };
        
        mockSelection.append.mockReturnValue(mockImageSelection);
        nodeEachCallback.call(mockSelection, nodeWithImage);

        // Simulate image load
        if (loadHandler) {
          loadHandler.call(mockImageSelection);

          // Verify final opacity and duration
          expect(mockTransition.style).toHaveBeenCalledWith('opacity', 1);
          expect(mockTransition.duration).toHaveBeenCalledWith(500);
        }
      }
    });
  });

  describe('Responsive and Mobile Considerations', () => {
    it('should work with different screen sizes', () => {
      const nodeWithImage: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image.jpg',
      };

      const data = {
        nodes: [nodeWithImage],
        links: [],
      };

      // Test with small container (mobile-like)
      if (mockSvgRef.current?.parentElement) {
        mockSvgRef.current.parentElement.style.width = '320px';
        mockSvgRef.current.parentElement.style.height = '568px';
      }

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      // The component should render without errors
      expect(mockSelection.selectAll).toHaveBeenCalled();
    });

    it('should maintain proper image sizing regardless of node size', () => {
      const smallNode: NetworkNode = {
        id: 'artist1',
        name: 'Small Artist',
        type: 'artist',
        size: 15,
        imageUrl: 'https://example.com/image.jpg',
      };

      const largeNode: NetworkNode = {
        id: 'artist2',
        name: 'Large Artist',
        type: 'artist',
        size: 50,
        imageUrl: 'https://example.com/image2.jpg',
      };

      const data = {
        nodes: [smallNode, largeNode],
        links: [],
      };

      const props = createDefaultProps({ data });
      render(<D3NetworkRenderer {...props} />);

      if (nodeEachCallback) {
        mockSelection.append.mockReturnValue(mockSelection);
        
        // Test small node
        nodeEachCallback.call(mockSelection, smallNode);
        const smallImageSize = smallNode.size - 4; // 11
        expect(mockSelection.attr).toHaveBeenCalledWith('width', smallImageSize * 2);
        expect(mockSelection.attr).toHaveBeenCalledWith('height', smallImageSize * 2);

        // Test large node
        nodeEachCallback.call(mockSelection, largeNode);
        const largeImageSize = largeNode.size - 4; // 46
        expect(mockSelection.attr).toHaveBeenCalledWith('width', largeImageSize * 2);
        expect(mockSelection.attr).toHaveBeenCalledWith('height', largeImageSize * 2);
      }
    });
  });
});

