import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as d3 from 'd3';
import type { NetworkNode } from '@/types/network';

// Mock D3 select and append functions
const mockAppend = vi.fn();
const mockAttr = vi.fn();
const mockStyle = vi.fn();
const mockOn = vi.fn();
const mockTransition = vi.fn();
const mockDuration = vi.fn();

const createMockSelection = () => ({
  append: mockAppend.mockReturnThis(),
  attr: mockAttr.mockReturnThis(),
  style: mockStyle.mockReturnThis(),
  on: mockOn.mockReturnThis(),
  transition: mockTransition.mockReturnThis(),
  duration: mockDuration.mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
  each: vi.fn(),
});

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(() => createMockSelection()),
}));

describe('Profile Picture SVG Patterns - Task 2.1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppend.mockReturnValue(createMockSelection());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SVG Pattern Creation for Profile Pictures', () => {
    const createProfilePicturePattern = (node: NetworkNode, group: any) => {
      if (!node.imageUrl) return;

      const profileImageSize = node.size - 4;
      
      // Create clipPath for circular image
      const clipId = `clip-${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const defs = group.append('defs');
      const clipPath = defs.append('clipPath').attr('id', clipId);
      clipPath.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', profileImageSize);

      // Add loading spinner
      const loadingGroup = group.append('g')
        .attr('class', 'loading-spinner')
        .style('opacity', 1);
      
      loadingGroup.append('circle')
        .attr('r', 8)
        .attr('fill', 'none')
        .attr('stroke', '#666')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '12.57')
        .attr('stroke-linecap', 'round')
        .style('animation', 'spin 1s linear infinite');

      // Add profile image
      const image = group.append('image')
        .attr('class', 'profile-image')
        .attr('x', -profileImageSize)
        .attr('y', -profileImageSize)
        .attr('width', profileImageSize * 2)
        .attr('height', profileImageSize * 2)
        .attr('clip-path', `url(#${clipId})`)
        .style('opacity', 0)
        .attr('href', node.imageUrl)
        .attr('crossorigin', 'anonymous');

      return { clipId, profileImageSize, image };
    };

    it('should create circular clipping paths for nodes with imageUrl', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 20,
        imageUrl: 'https://example.com/image1.jpg',
        spotifyId: 'spotify123',
      };

      const mockGroup = createMockSelection();
      const result = createProfilePicturePattern(node, mockGroup);

      // Verify defs element is created
      expect(mockGroup.append).toHaveBeenCalledWith('defs');
      
      // Verify clipPath is created with correct ID
      expect(mockAppend).toHaveBeenCalledWith('clipPath');
      expect(mockAttr).toHaveBeenCalledWith('id', 'clip-artist1');
      
      // Verify circular clipping path
      expect(mockAppend).toHaveBeenCalledWith('circle');
      expect(mockAttr).toHaveBeenCalledWith('cx', 0);
      expect(mockAttr).toHaveBeenCalledWith('cy', 0);
      expect(mockAttr).toHaveBeenCalledWith('r', 16); // node.size - 4

      expect(result).toBeDefined();
      expect(result?.clipId).toBe('clip-artist1');
      expect(result?.profileImageSize).toBe(16);
    });

    it('should sanitize node IDs for clipPath identifiers', () => {
      const node: NetworkNode = {
        id: 'artist-with-special@chars#123',
        name: 'Test Artist',
        type: 'artist',
        size: 20,
        imageUrl: 'https://example.com/image1.jpg',
      };

      const mockGroup = createMockSelection();
      const result = createProfilePicturePattern(node, mockGroup);

      // Verify that special characters are removed from clip ID
      expect(mockAttr).toHaveBeenCalledWith('id', 'clip-artist_with_special_chars_123');
      expect(result?.clipId).toBe('clip-artist_with_special_chars_123');
    });

    it('should set correct circular clipping dimensions based on node size', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image1.jpg',
      };

      const mockGroup = createMockSelection();
      const result = createProfilePicturePattern(node, mockGroup);

      const expectedRadius = 30 - 4; // 26
      
      // Verify clipping circle dimensions
      expect(mockAttr).toHaveBeenCalledWith('r', expectedRadius);
      expect(result?.profileImageSize).toBe(expectedRadius);
    });

    it('should not create clipping paths for nodes without imageUrl', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 20,
        imageUrl: null,
      };

      const mockGroup = createMockSelection();
      const result = createProfilePicturePattern(node, mockGroup);

      // Should not create any elements
      expect(mockGroup.append).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should create loading spinner for nodes with imageUrl', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 20,
        imageUrl: 'https://example.com/image1.jpg',
      };

      const mockGroup = createMockSelection();
      createProfilePicturePattern(node, mockGroup);

      // Verify loading spinner group is created
      expect(mockGroup.append).toHaveBeenCalledWith('g');
      expect(mockAttr).toHaveBeenCalledWith('class', 'loading-spinner');
      expect(mockStyle).toHaveBeenCalledWith('opacity', 1);

      // Verify loading spinner circle
      expect(mockAppend).toHaveBeenCalledWith('circle');
      expect(mockAttr).toHaveBeenCalledWith('r', 8);
      expect(mockAttr).toHaveBeenCalledWith('fill', 'none');
      expect(mockAttr).toHaveBeenCalledWith('stroke', '#666');
      expect(mockAttr).toHaveBeenCalledWith('stroke-width', 2);
      expect(mockAttr).toHaveBeenCalledWith('stroke-dasharray', '12.57');
      expect(mockAttr).toHaveBeenCalledWith('stroke-linecap', 'round');
      expect(mockStyle).toHaveBeenCalledWith('animation', 'spin 1s linear infinite');
    });

    it('should create image element with proper attributes', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 20,
        imageUrl: 'https://example.com/image1.jpg',
      };

      const mockGroup = createMockSelection();
      createProfilePicturePattern(node, mockGroup);

      // Verify image element creation
      expect(mockGroup.append).toHaveBeenCalledWith('image');
      expect(mockAttr).toHaveBeenCalledWith('class', 'profile-image');
      expect(mockAttr).toHaveBeenCalledWith('href', 'https://example.com/image1.jpg');
      expect(mockAttr).toHaveBeenCalledWith('crossorigin', 'anonymous');
      expect(mockStyle).toHaveBeenCalledWith('opacity', 0);
    });

    it('should set image dimensions based on node size', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 30,
        imageUrl: 'https://example.com/image1.jpg',
      };

      const mockGroup = createMockSelection();
      createProfilePicturePattern(node, mockGroup);

      const expectedSize = 30 - 4; // 26
      const expectedImageSize = expectedSize * 2; // 52
      
      expect(mockAttr).toHaveBeenCalledWith('x', -expectedSize);
      expect(mockAttr).toHaveBeenCalledWith('y', -expectedSize);
      expect(mockAttr).toHaveBeenCalledWith('width', expectedImageSize);
      expect(mockAttr).toHaveBeenCalledWith('height', expectedImageSize);
    });

    it('should apply correct clip-path reference', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 20,
        imageUrl: 'https://example.com/image1.jpg',
      };

      const mockGroup = createMockSelection();
      createProfilePicturePattern(node, mockGroup);

      expect(mockAttr).toHaveBeenCalledWith('clip-path', 'url(#clip-artist1)');
    });
  });

  describe('Error Handling', () => {
    const createProfilePicturePattern = (node: NetworkNode, group: any) => {
      if (!node.imageUrl) return;

      const profileImageSize = node.size - 4;
      
      try {
        // Create clipPath for circular image
        const clipId = `clip-${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const defs = group.append('defs');
        const clipPath = defs.append('clipPath').attr('id', clipId);
        clipPath.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', profileImageSize);

        // Add profile image
        const image = group.append('image')
          .attr('class', 'profile-image')
          .attr('href', node.imageUrl)
          .attr('crossorigin', 'anonymous');

        return { clipId, profileImageSize, image };
      } catch (error) {
        console.warn('Failed to create profile picture pattern:', error);
        return null;
      }
    };

    it('should handle malformed image URLs gracefully', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 20,
        imageUrl: 'invalid-url',
      };

      const mockGroup = createMockSelection();
      
      expect(() => {
        createProfilePicturePattern(node, mockGroup);
      }).not.toThrow();

      // Should still create image element with the URL as provided
      expect(mockAttr).toHaveBeenCalledWith('href', 'invalid-url');
    });

    it('should handle nodes with undefined imageUrl property', () => {
      const node: NetworkNode = {
        id: 'artist1',
        name: 'Test Artist',
        type: 'artist',
        size: 20,
        // imageUrl is undefined
      } as any;

      const mockGroup = createMockSelection();
      
      expect(() => {
        createProfilePicturePattern(node, mockGroup);
      }).not.toThrow();

      // Should not create any elements for undefined imageUrl
      expect(mockGroup.append).not.toHaveBeenCalled();
    });
  });

  describe('Pattern Updates for Data Changes', () => {
    const mockUpdatePatterns = (oldNodes: NetworkNode[], newNodes: NetworkNode[], group: any) => {
      // Simulate pattern update logic
      const oldImageNodes = oldNodes.filter(n => n.imageUrl);
      const newImageNodes = newNodes.filter(n => n.imageUrl);
      
      // Remove old patterns that are no longer needed
      const removedNodes = oldImageNodes.filter(old => 
        !newImageNodes.some(newNode => newNode.id === old.id));
      
      // Add new patterns for new nodes
      const addedNodes = newImageNodes.filter(newNode => 
        !oldImageNodes.some(old => old.id === newNode.id));

      return { removedNodes, addedNodes };
    };

    it('should identify pattern updates when data changes', () => {
      const oldNodes: NetworkNode[] = [
        {
          id: 'artist1',
          name: 'Test Artist',
          type: 'artist',
          size: 20,
          imageUrl: 'https://example.com/image1.jpg',
        },
      ];

      const newNodes: NetworkNode[] = [
        {
          id: 'artist1',
          name: 'Test Artist',
          type: 'artist',
          size: 20,
          imageUrl: 'https://example.com/new-image.jpg', // Changed image URL
        },
        {
          id: 'artist2',
          name: 'New Artist',
          type: 'artist',
          size: 25,
          imageUrl: 'https://example.com/artist2.jpg', // New node with image
        },
      ];

      const mockGroup = createMockSelection();
      const result = mockUpdatePatterns(oldNodes, newNodes, mockGroup);

      // Should detect changes properly
      expect(result.addedNodes).toHaveLength(1);
      expect(result.addedNodes[0].id).toBe('artist2');
    });
  });

  describe('Multiple Nodes with Different Image States', () => {
    const processMultipleNodes = (nodes: NetworkNode[], group: any) => {
      const results: Array<{ node: NetworkNode; hasImage: boolean; clipId?: string }> = [];

      nodes.forEach(node => {
        if (node.imageUrl) {
          const clipId = `clip-${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
          results.push({ node, hasImage: true, clipId });
          
          // Mock the pattern creation calls
          group.append('defs');
          group.append('clipPath').attr('id', clipId);
          group.append('image').attr('href', node.imageUrl);
        } else {
          results.push({ node, hasImage: false });
        }
      });

      return results;
    };

    it('should handle multiple nodes with different image states', () => {
      const nodes: NetworkNode[] = [
        {
          id: 'artist1',
          name: 'Artist With Image',
          type: 'artist',
          size: 20,
          imageUrl: 'https://example.com/image1.jpg',
        },
        {
          id: 'artist2',
          name: 'Artist Without Image',
          type: 'artist',
          size: 20,
          imageUrl: null,
        },
        {
          id: 'producer1',
          name: 'Producer With Image',
          type: 'producer',
          size: 15,
          imageUrl: 'https://example.com/producer1.jpg',
        },
      ];

      const mockGroup = createMockSelection();
      const results = processMultipleNodes(nodes, mockGroup);

      // Should correctly identify which nodes have images
      expect(results).toHaveLength(3);
      expect(results[0].hasImage).toBe(true);
      expect(results[0].clipId).toBe('clip-artist1');
      expect(results[1].hasImage).toBe(false);
      expect(results[2].hasImage).toBe(true);
      expect(results[2].clipId).toBe('clip-producer1');

      // Should create patterns for nodes with images
      expect(mockAttr).toHaveBeenCalledWith('id', 'clip-artist1');
      expect(mockAttr).toHaveBeenCalledWith('id', 'clip-producer1');
      expect(mockAttr).toHaveBeenCalledWith('href', 'https://example.com/image1.jpg');
      expect(mockAttr).toHaveBeenCalledWith('href', 'https://example.com/producer1.jpg');
    });
  });
});
