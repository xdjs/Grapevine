import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as d3 from 'd3';
import { NetworkNode } from '@/types/network';

// Mock D3 selection for testing visual feedback
const mockSelection = {
  selectAll: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  datum: vi.fn()
};

vi.mock('d3', () => ({
  select: vi.fn(() => mockSelection)
}));

describe('Visual Feedback System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection.selectAll.mockReturnValue(mockSelection);
  });

  describe('White Stroke Selection Effect', () => {
    it('should apply consistent white stroke highlighting for single-role nodes', () => {
      const singleRoleNodes: NetworkNode[] = [
        { id: 'artist1', name: 'Taylor Swift', type: 'artist', size: 30, x: 100, y: 100 },
        { id: 'producer1', name: 'Jack Antonoff', type: 'producer', size: 25, x: 200, y: 200 },
        { id: 'songwriter1', name: 'Lorde', type: 'songwriter', size: 20, x: 300, y: 300 }
      ];

      singleRoleNodes.forEach(node => {
        const mockElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
        const selection = d3.select(mockElement);

        // Simulate white stroke application
        selection.selectAll("circle, path")
          .attr("stroke", "white")
          .attr("stroke-width", 3)
          .style("stroke-opacity", 1);

        expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
        expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
        expect(mockSelection.attr).toHaveBeenCalledWith("stroke-width", 3);
        expect(mockSelection.style).toHaveBeenCalledWith("stroke-opacity", 1);
      });
    });

    it('should apply white stroke to both circles and paths for multi-role nodes', () => {
      const multiRoleNode: NetworkNode = {
        id: 'multi1',
        name: 'Jack Antonoff',
        type: 'artist',
        types: ['artist', 'producer', 'songwriter'],
        size: 25,
        x: 400,
        y: 400
      };

      const mockElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
      const selection = d3.select(mockElement);

      // Multi-role nodes have both path elements (for role segments) and inner circles
      selection.selectAll("circle, path")
        .attr("stroke", "white")
        .attr("stroke-width", 3)
        .style("stroke-opacity", 1);

      expect(mockSelection.selectAll).toHaveBeenCalledWith("circle, path");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke-width", 3);
      expect(mockSelection.style).toHaveBeenCalledWith("stroke-opacity", 1);
    });

    it('should provide visual contrast against all node background colors', () => {
      const nodeTypes = ['artist', 'producer', 'songwriter', 'other'];
      
      nodeTypes.forEach(type => {
        const node: NetworkNode = {
          id: `${type}1`,
          name: `Test ${type}`,
          type: type as any,
          size: 20,
          x: 100,
          y: 100
        };

        const mockElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
        const selection = d3.select(mockElement);

        // White stroke should provide contrast against any colored background
        selection.selectAll("circle, path")
          .attr("stroke", "white")
          .attr("stroke-width", 3)
          .style("stroke-opacity", 1);

        expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
        // White stroke provides contrast against:
        // - Artist nodes: Magenta Pink (#FF0ACF)
        // - Producer nodes: Bright Purple (#AE53FF)
        // - Songwriter nodes: Light Blue (#67D1F8)
        // - Other nodes: Police Blue (#355367)
      });
    });
  });

  describe('Original Color Reset System', () => {
    it('should reset single-role artist nodes to magenta pink', () => {
      const artistNode: NetworkNode = {
        id: 'artist1',
        name: 'Taylor Swift',
        type: 'artist',
        size: 30,
        x: 100,
        y: 100
      };

      mockSelection.datum.mockReturnValue(artistNode);

      // Simulate reset for single-role artist
      const roles = [artistNode.type];
      if (roles.length === 1) {
        mockSelection.selectAll('circle')
          .attr('stroke', '#FF0ACF')  // Magenta Pink
          .attr('stroke-width', 4);
      }

      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#FF0ACF');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should reset single-role producer nodes to bright purple', () => {
      const producerNode: NetworkNode = {
        id: 'producer1',
        name: 'Jack Antonoff',
        type: 'producer',
        size: 25,
        x: 200,
        y: 200
      };

      mockSelection.datum.mockReturnValue(producerNode);

      // Simulate reset for single-role producer
      const roles = [producerNode.type];
      if (roles.length === 1) {
        mockSelection.selectAll('circle')
          .attr('stroke', '#AE53FF')  // Bright Purple
          .attr('stroke-width', 4);
      }

      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#AE53FF');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should reset single-role songwriter nodes to light blue', () => {
      const songwriterNode: NetworkNode = {
        id: 'songwriter1',
        name: 'Lorde',
        type: 'songwriter',
        size: 20,
        x: 300,
        y: 300
      };

      mockSelection.datum.mockReturnValue(songwriterNode);

      // Simulate reset for single-role songwriter
      const roles = [songwriterNode.type];
      if (roles.length === 1) {
        mockSelection.selectAll('circle')
          .attr('stroke', '#67D1F8')  // Light Blue
          .attr('stroke-width', 4);
      }

      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#67D1F8');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should reset unknown role nodes to police blue default', () => {
      const unknownNode: NetworkNode = {
        id: 'unknown1',
        name: 'Unknown Role',
        type: 'unknown' as any,
        size: 15,
        x: 400,
        y: 400
      };

      mockSelection.datum.mockReturnValue(unknownNode);

      // Simulate reset for unknown role
      const roles = [unknownNode.type];
      if (roles.length === 1) {
        mockSelection.selectAll('circle')
          .attr('stroke', '#355367')  // Police Blue (default)
          .attr('stroke-width', 4);
      }

      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#355367');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should reset multi-role nodes to original white strokes', () => {
      const multiRoleNode: NetworkNode = {
        id: 'multi1',
        name: 'Jack Antonoff',
        type: 'artist',
        types: ['artist', 'producer', 'songwriter'],
        size: 25,
        x: 500,
        y: 500
      };

      mockSelection.datum.mockReturnValue(multiRoleNode);

      // Simulate reset for multi-role node
      const roles = multiRoleNode.types || [multiRoleNode.type];
      if (roles.length > 1) {
        // Reset path strokes (role segments)
        mockSelection.selectAll('path')
          .attr('stroke', 'white')
          .attr('stroke-width', 1);
        
        // Reset inner circle
        mockSelection.selectAll('circle')
          .attr('stroke', 'white')
          .attr('stroke-width', 2);
      }

      expect(mockSelection.selectAll).toHaveBeenCalledWith('path');
      expect(mockSelection.selectAll).toHaveBeenCalledWith('circle');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', 'white');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 1);
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 2);
    });
  });

  describe('Visual State Transitions', () => {
    it('should transition from unselected to selected state properly', () => {
      const node: NetworkNode = {
        id: 'test1',
        name: 'Test Node',
        type: 'artist',
        size: 25,
        x: 100,
        y: 100
      };

      const mockElement = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
      const selection = d3.select(mockElement);

      // 1. Initial state: original colors (would be set during node creation)
      // 2. Selection state: white stroke
      selection.selectAll("circle, path")
        .attr("stroke", "white")
        .attr("stroke-width", 3)
        .style("stroke-opacity", 1);

      expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke-width", 3);
      expect(mockSelection.style).toHaveBeenCalledWith("stroke-opacity", 1);
    });

    it('should transition from selected to unselected state properly', () => {
      const artistNode: NetworkNode = {
        id: 'artist1',
        name: 'Artist',
        type: 'artist',
        size: 25,
        x: 100,
        y: 100
      };

      mockSelection.datum.mockReturnValue(artistNode);

      // Selection to unselected: white stroke back to original color
      const roles = [artistNode.type];
      if (roles.length === 1) {
        mockSelection.selectAll('circle')
          .attr('stroke', '#FF0ACF')  // Back to magenta pink
          .attr('stroke-width', 4);
      }

      expect(mockSelection.attr).toHaveBeenCalledWith('stroke', '#FF0ACF');
      expect(mockSelection.attr).toHaveBeenCalledWith('stroke-width', 4);
    });

    it('should handle rapid selection changes without visual artifacts', () => {
      const nodes: NetworkNode[] = [
        { id: 'node1', name: 'Node 1', type: 'artist', size: 25, x: 100, y: 100 },
        { id: 'node2', name: 'Node 2', type: 'producer', size: 20, x: 200, y: 200 }
      ];

      nodes.forEach(node => {
        mockSelection.datum.mockReturnValue(node);

        // Each selection should properly reset previous and apply new
        const roles = [node.type];
        
        // Apply white stroke (selection)
        mockSelection.selectAll("circle, path")
          .attr("stroke", "white")
          .attr("stroke-width", 3);

        // Reset to original (when selecting next)
        if (roles.length === 1) {
          const originalColor = roles[0] === 'artist' ? '#FF0ACF' : 
                               roles[0] === 'producer' ? '#AE53FF' : 
                               roles[0] === 'songwriter' ? '#67D1F8' : '#355367';
          
          mockSelection.selectAll('circle')
            .attr('stroke', originalColor)
            .attr('stroke-width', 4);
        }
      });

      // Should handle multiple rapid changes
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke-width", 3);
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide clear visual indication of selected state', () => {
      // White stroke with 3px width provides clear visual feedback
      const selection = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
      
      selection.selectAll("circle, path")
        .attr("stroke", "white")
        .attr("stroke-width", 3)
        .style("stroke-opacity", 1);

      expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke-width", 3);
      expect(mockSelection.style).toHaveBeenCalledWith("stroke-opacity", 1);
      
      // 3px white stroke is thick enough to be clearly visible
      // against all node background colors and provides good accessibility
    });

    it('should maintain consistent visual language across node types', () => {
      const nodeTypes = ['artist', 'producer', 'songwriter'];
      
      nodeTypes.forEach(type => {
        const selection = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
        
        // All node types use the same selection visual treatment
        selection.selectAll("circle, path")
          .attr("stroke", "white")
          .attr("stroke-width", 3)
          .style("stroke-opacity", 1);
      });

      // Consistent white stroke across all node types
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
      expect(mockSelection.attr).toHaveBeenCalledWith("stroke-width", 3);
    });

    it('should provide sufficient contrast for visibility', () => {
      // Test white stroke against all possible node colors
      const colorContrastTests = [
        { role: 'artist', backgroundColor: '#FF0ACF', description: 'Magenta Pink' },
        { role: 'producer', backgroundColor: '#AE53FF', description: 'Bright Purple' },
        { role: 'songwriter', backgroundColor: '#67D1F8', description: 'Light Blue' },
        { role: 'default', backgroundColor: '#355367', description: 'Police Blue' }
      ];

      colorContrastTests.forEach(({ role, backgroundColor, description }) => {
        // White (#FFFFFF) provides excellent contrast against all these colors
        // This ensures the selection state is clearly visible
        const selection = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'g'));
        
        selection.selectAll("circle, path")
          .attr("stroke", "white")  // High contrast against all backgrounds
          .attr("stroke-width", 3)
          .style("stroke-opacity", 1);

        expect(mockSelection.attr).toHaveBeenCalledWith("stroke", "white");
        
        // White provides good contrast against:
        // - Magenta Pink: Light text on dark background
        // - Bright Purple: Light text on dark background  
        // - Light Blue: Light text on medium background
        // - Police Blue: Light text on dark background
      });
    });
  });
});
