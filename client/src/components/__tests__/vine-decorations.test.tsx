import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as d3 from 'd3';
import { VineDecorations } from '../vine-decorations';
import { NetworkNode, NetworkLink } from '../../types/network';

// Mock D3 selection methods
const mockSelection = {
  append: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  classed: vi.fn().mockReturnThis(),
  transition: vi.fn().mockReturnThis(),
  duration: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  selectAll: vi.fn().mockReturnThis(),
  each: vi.fn().mockReturnThis(),
  datum: vi.fn().mockReturnValue({ source: 'artist1', target: 'artist2' }),
  size: vi.fn().mockReturnValue(1),
  text: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
};

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(() => mockSelection),
  selectAll: vi.fn(() => mockSelection),
}));

describe('VineDecorations', () => {
  let vineDecorations: VineDecorations;
  let mockSvg: any;
  let mockLinkGroup: any;

  beforeEach(() => {
    vineDecorations = new VineDecorations();
    mockSvg = {
      append: vi.fn(() => ({
        attr: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
        })),
      })),
    };
    mockLinkGroup = {
      append: vi.fn(() => ({
        attr: vi.fn().mockReturnThis(),
        style: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        classed: vi.fn().mockReturnThis(),
        select: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
          style: vi.fn().mockReturnThis(),
        })),
        selectAll: vi.fn(() => ({
          each: vi.fn().mockReturnThis(),
          attr: vi.fn().mockReturnThis(),
          size: vi.fn().mockReturnValue(1),
        })),
      })),
      selectAll: vi.fn(() => ({
        each: vi.fn().mockReturnThis(),
        attr: vi.fn().mockReturnThis(),
        size: vi.fn().mockReturnValue(1),
      })),
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeDefs', () => {
    it('should create SVG definitions for vine decorations', () => {
      const mockDefs = {
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
          append: vi.fn(() => ({
            attr: vi.fn().mockReturnThis(),
          })),
        })),
      };

      mockSvg.append.mockReturnValue(mockDefs);

      vineDecorations.initializeDefs(mockSvg as any);

      expect(mockSvg.append).toHaveBeenCalledWith('defs');
      expect(mockDefs.append).toHaveBeenCalledWith('filter');
      expect(mockDefs.append).toHaveBeenCalledWith('linearGradient');
    });

    it('should create leaf shadow filter with proper attributes', () => {
      const mockFilter = {
        attr: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
        })),
      };

      const mockDefs = {
        append: vi.fn(() => mockFilter),
      };

      mockSvg.append.mockReturnValue(mockDefs);

      vineDecorations.initializeDefs(mockSvg as any);

      expect(mockFilter.attr).toHaveBeenCalledWith('id', 'leaf-shadow');
      expect(mockFilter.attr).toHaveBeenCalledWith('x', '-50%');
      expect(mockFilter.attr).toHaveBeenCalledWith('y', '-50%');
      expect(mockFilter.attr).toHaveBeenCalledWith('width', '200%');
      expect(mockFilter.attr).toHaveBeenCalledWith('height', '200%');
    });

    it('should create leaf gradient with proper colors', () => {
      const mockGradient = {
        attr: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
        })),
      };

      const mockDefs = {
        append: vi.fn(() => mockGradient),
      };

      mockSvg.append.mockReturnValue(mockDefs);

      vineDecorations.initializeDefs(mockSvg as any);

      expect(mockGradient.attr).toHaveBeenCalledWith('id', 'leaf-gradient');
      expect(mockGradient.attr).toHaveBeenCalledWith('gradientUnits', 'userSpaceOnUse');
    });
  });

  describe('createLeaves', () => {
    it('should create leaf groups with proper attributes', () => {
      const mockLeafGroup = {
        attr: vi.fn().mockReturnThis(),
        style: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
          style: vi.fn().mockReturnThis(),
        })),
      };

      mockLinkGroup.append.mockReturnValue(mockLeafGroup);

      vineDecorations.createLeaves(mockLinkGroup as any, 0);

      expect(mockLeafGroup.attr).toHaveBeenCalledWith('class', 'link-leaf');
      expect(mockLeafGroup.attr).toHaveBeenCalledWith('data-leaf-index', 0);
      expect(mockLeafGroup.style).toHaveBeenCalledWith('cursor', 'pointer');
      expect(mockLeafGroup.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should create leaf path with proper styling', () => {
      const mockLeafGroup = {
        attr: vi.fn().mockReturnThis(),
        style: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
          style: vi.fn().mockReturnThis(),
        })),
      };

      mockLinkGroup.append.mockReturnValue(mockLeafGroup);

      vineDecorations.createLeaves(mockLinkGroup as any, 0);

      expect(mockLeafGroup.append).toHaveBeenCalledWith('path');
      expect(mockLeafGroup.append().attr).toHaveBeenCalledWith('class', 'leaf');
      expect(mockLeafGroup.append().attr).toHaveBeenCalledWith('fill', 'url(#leaf-gradient)');
      expect(mockLeafGroup.append().attr).toHaveBeenCalledWith('stroke', '#2D5A1A');
      expect(mockLeafGroup.append().attr).toHaveBeenCalledWith('stroke-width', 0.25);
    });

    it('should create leaf vein system', () => {
      const mockLeafGroup = {
        attr: vi.fn().mockReturnThis(),
        style: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
          style: vi.fn().mockReturnThis(),
        })),
      };

      mockLinkGroup.append.mockReturnValue(mockLeafGroup);

      vineDecorations.createLeaves(mockLinkGroup as any, 0);

      // Should create main vein
      expect(mockLeafGroup.append).toHaveBeenCalledWith('line');
      expect(mockLeafGroup.append().attr).toHaveBeenCalledWith('class', 'leaf-vein main-vein');
      expect(mockLeafGroup.append().attr).toHaveBeenCalledWith('stroke', '#2D5A1A');
      expect(mockLeafGroup.append().attr).toHaveBeenCalledWith('stroke-width', 0.18);
    });

    it('should create multiple leaves based on hash', () => {
      const mockLeafGroup = {
        attr: vi.fn().mockReturnThis(),
        style: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
          style: vi.fn().mockReturnThis(),
        })),
      };

      mockLinkGroup.append.mockReturnValue(mockLeafGroup);

      vineDecorations.createLeaves(mockLinkGroup as any, 0);

      // Should create at least one leaf group
      expect(mockLinkGroup.append).toHaveBeenCalled();
    });
  });

  describe('createGrapes', () => {
    it('should create grape clusters with proper attributes', () => {
      const mockClusterGroup = {
        attr: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
          style: vi.fn().mockReturnThis(),
        })),
      };

      mockLinkGroup.append.mockReturnValue(mockClusterGroup);

      vineDecorations.createGrapes(mockLinkGroup as any, 0);

      expect(mockClusterGroup.attr).toHaveBeenCalledWith('class', 'grape-cluster');
      expect(mockClusterGroup.attr).toHaveBeenCalledWith('data-cluster-index', 0);
    });

    it('should create individual grapes with proper styling', () => {
      const mockClusterGroup = {
        attr: vi.fn().mockReturnThis(),
        append: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
          style: vi.fn().mockReturnThis(),
        })),
      };

      mockLinkGroup.append.mockReturnValue(mockClusterGroup);

      vineDecorations.createGrapes(mockLinkGroup as any, 0);

      expect(mockClusterGroup.append).toHaveBeenCalledWith('g');
      expect(mockClusterGroup.append().attr).toHaveBeenCalledWith('class', 'grape-item');
      expect(mockClusterGroup.append().append).toHaveBeenCalledWith('circle');
      expect(mockClusterGroup.append().append().attr).toHaveBeenCalledWith('class', 'grape');
      expect(mockClusterGroup.append().append().attr).toHaveBeenCalledWith('fill', '#6A4C93');
      expect(mockClusterGroup.append().append().attr).toHaveBeenCalledWith('stroke', '#4A2E6B');
    });
  });

  describe('updateLeaves', () => {
    it('should update leaf positions based on source and target nodes', () => {
      const source: NetworkNode = { id: 'artist1', name: 'Artist 1', type: 'artist', x: 100, y: 100, size: 20 };
      const target: NetworkNode = { id: 'artist2', name: 'Artist 2', type: 'artist', x: 200, y: 200, size: 20 };

      const mockLeafGroup = {
        select: vi.fn(() => ({
          attr: vi.fn().mockReturnThis(),
        })),
        selectAll: vi.fn(() => ({
          each: vi.fn().mockReturnThis(),
          attr: vi.fn().mockReturnThis(),
          size: vi.fn().mockReturnValue(1),
        })),
        each: vi.fn((callback) => {
          callback({}, 0);
        }),
      };

      mockLinkGroup.selectAll.mockReturnValue(mockLeafGroup);

      vineDecorations.updateLeaves(mockLinkGroup as any, 0, source, target);

      expect(mockLinkGroup.selectAll).toHaveBeenCalledWith('.link-leaf');
    });

    it('should update leaf path with proper positioning', () => {
      const source: NetworkNode = { id: 'artist1', name: 'Artist 1', type: 'artist', x: 100, y: 100, size: 20 };
      const target: NetworkNode = { id: 'artist2', name: 'Artist 2', type: 'artist', x: 200, y: 200, size: 20 };

      const mockLeaf = {
        attr: vi.fn().mockReturnThis(),
      };

      const mockLeafGroup = {
        select: vi.fn(() => mockLeaf),
        selectAll: vi.fn(() => ({
          each: vi.fn().mockReturnThis(),
          attr: vi.fn().mockReturnThis(),
          size: vi.fn().mockReturnValue(1),
        })),
        each: vi.fn((callback) => {
          callback({}, 0);
        }),
      };

      mockLinkGroup.selectAll.mockReturnValue(mockLeafGroup);

      vineDecorations.updateLeaves(mockLinkGroup as any, 0, source, target);

      expect(mockLeafGroup.select).toHaveBeenCalledWith('.leaf');
      expect(mockLeaf.attr).toHaveBeenCalledWith('d', expect.any(String));
      expect(mockLeaf.attr).toHaveBeenCalledWith('transform', expect.stringContaining('rotate'));
    });
  });

  describe('updateGrapes', () => {
    it('should update grape cluster positions', () => {
      const source: NetworkNode = { id: 'artist1', name: 'Artist 1', type: 'artist', x: 100, y: 100, size: 20 };
      const target: NetworkNode = { id: 'artist2', name: 'Artist 2', type: 'artist', x: 200, y: 200, size: 20 };

      const mockClusterGroup = {
        attr: vi.fn().mockReturnThis(),
        selectAll: vi.fn(() => ({
          each: vi.fn().mockReturnThis(),
          attr: vi.fn().mockReturnThis(),
          size: vi.fn().mockReturnValue(1),
        })),
      };

      mockLinkGroup.selectAll.mockReturnValue({
        each: vi.fn((callback) => {
          callback({}, 0);
        }),
      });

      vineDecorations.updateGrapes(mockLinkGroup as any, 0, source, target);

      expect(mockLinkGroup.selectAll).toHaveBeenCalledWith('.grape-cluster');
    });
  });

  describe('leaf click interaction', () => {
    it('should handle leaf click events', () => {
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as any;

      const mockLeafGroup = {
        classed: vi.fn().mockReturnValue(false),
        attr: vi.fn().mockReturnValue('translate(100, 100)'),
        transition: vi.fn(() => ({
          duration: vi.fn(() => ({
            attr: vi.fn(() => ({
              on: vi.fn((event, callback) => {
                if (event === 'end') {
                  callback();
                }
              }),
            })),
          })),
        })),
      };

      // Create a spy for the handleLeafClick method
      const handleLeafClickSpy = vi.spyOn(vineDecorations as any, 'handleLeafClick');

      // Simulate the click handler being called
      const clickHandler = mockLinkGroup.append().on.mock.calls.find(
        call => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        clickHandler(mockEvent, mockLeafGroup, 0, 0);
      }

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should prevent multiple animations on the same leaf', () => {
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as any;

      const mockLeafGroup = {
        classed: vi.fn().mockReturnValue(true), // Already shaking
        attr: vi.fn().mockReturnValue('translate(100, 100)'),
      };

      // Create a spy for the handleLeafClick method
      const handleLeafClickSpy = vi.spyOn(vineDecorations as any, 'handleLeafClick');

      // Simulate the click handler being called
      const clickHandler = mockLinkGroup.append().on.mock.calls.find(
        call => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        clickHandler(mockEvent, mockLeafGroup, 0, 0);
      }

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      // Should not start animation if already shaking
      expect(mockLeafGroup.classed).toHaveBeenCalledWith('shaking');
    });

    it('should add shaking class when animation starts', () => {
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as any;

      const mockLeafGroup = {
        classed: vi.fn().mockReturnValue(false),
        attr: vi.fn().mockReturnValue('translate(100, 100)'),
        transition: vi.fn(() => ({
          duration: vi.fn(() => ({
            attr: vi.fn(() => ({
              on: vi.fn((event, callback) => {
                if (event === 'end') {
                  callback();
                }
              }),
            })),
          })),
        })),
      };

      // Simulate the click handler being called
      const clickHandler = mockLinkGroup.append().on.mock.calls.find(
        call => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        clickHandler(mockEvent, mockLeafGroup, 0, 0);
      }

      expect(mockLeafGroup.classed).toHaveBeenCalledWith('shaking', true);
    });
  });

  describe('animation properties', () => {
    it('should use correct animation duration and intensity', () => {
      const mockEvent = {
        stopPropagation: vi.fn(),
      } as any;

      const mockLeafGroup = {
        classed: vi.fn().mockReturnValue(false),
        attr: vi.fn().mockReturnValue('translate(100, 100)'),
        transition: vi.fn(() => ({
          duration: vi.fn(() => ({
            attr: vi.fn(() => ({
              on: vi.fn((event, callback) => {
                if (event === 'end') {
                  callback();
                }
              }),
            })),
          })),
        })),
      };

      // Simulate the click handler being called
      const clickHandler = mockLinkGroup.append().on.mock.calls.find(
        call => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        clickHandler(mockEvent, mockLeafGroup, 0, 0);
      }

      // Check that transition is called with proper duration
      expect(mockLeafGroup.transition).toHaveBeenCalled();
    });
  });
});
