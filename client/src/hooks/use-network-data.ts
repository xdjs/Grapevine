import { useState, useCallback, useMemo } from 'react';
import { NetworkData, NetworkNode, NetworkLink } from '@/types/network';

interface UseNetworkDataProps {
  data: NetworkData;
}

interface UseNetworkDataReturn {
  // State
  expandedNodes: Set<string>;
  fullNetworkData: NetworkData | null;
  isExpandedMode: boolean;
  
  // Computed values
  mainArtistNode: NetworkNode | undefined;
  visibleNodes: NetworkNode[];
  visibleLinks: NetworkLink[];
  displayData: NetworkData;
  
  // Functions
  getFirstDegreeCollaborators: () => Set<string>;
  expandNodeNetwork: (nodeName: string, nodeId?: string) => Promise<void>;
  collapseNodeNetwork: (nodeName: string) => void;
  resetToFirstDegree: () => void;
}

export function useNetworkData({ data }: UseNetworkDataProps): UseNetworkDataReturn {
  // State for managing expanded networks
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [fullNetworkData, setFullNetworkData] = useState<NetworkData | null>(null);
  const [isExpandedMode, setIsExpandedMode] = useState(false);

  // Find the main artist node (the largest artist node)
  const mainArtistNode = useMemo(() => {
    return data.nodes.find(node => 
      node.size === 30 && (node.type === 'artist' || (node.types && node.types.includes('artist')))
    );
  }, [data.nodes]);

  // Get first-degree collaborators (nodes directly connected to main artist)
  const getFirstDegreeCollaborators = useCallback(() => {
    if (!mainArtistNode) return new Set<string>();
    
    const firstDegreeIds = new Set<string>();
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      if (sourceId === mainArtistNode.name) {
        firstDegreeIds.add(targetId);
      } else if (targetId === mainArtistNode.name) {
        firstDegreeIds.add(sourceId);
      }
    });
    
    return firstDegreeIds;
  }, [mainArtistNode, data.links]);

  // Get visible nodes based on expansion state
  const getVisibleNodes = useCallback(() => {
    if (!mainArtistNode) return data.nodes;
    
    const firstDegreeIds = getFirstDegreeCollaborators();
    const visibleIds = new Set([mainArtistNode.id]);
    
    // Always include main artist
    visibleIds.add(mainArtistNode.id);
    
    // Include first-degree collaborators
    firstDegreeIds.forEach(id => visibleIds.add(id));
    
    // Include expanded nodes and their connections
    expandedNodes.forEach(expandedNodeId => {
      visibleIds.add(expandedNodeId);
      
      // Add all nodes connected to this expanded node
      data.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        if (sourceId === expandedNodeId) {
          visibleIds.add(targetId);
        } else if (targetId === expandedNodeId) {
          visibleIds.add(sourceId);
        }
      });
    });
    
    return data.nodes.filter(node => visibleIds.has(node.id));
  }, [mainArtistNode, data.nodes, data.links, expandedNodes, getFirstDegreeCollaborators]);

  // Get visible links based on visible nodes
  const getVisibleLinks = useCallback(() => {
    const visibleNodeIds = new Set(getVisibleNodes().map(node => node.id));
    
    return data.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
  }, [data.links, getVisibleNodes]);

  // Function to expand a node's network
  const expandNodeNetwork = useCallback(async (nodeName: string, nodeId?: string) => {
    console.log(`🔗 [DEBUG] expandNodeNetwork called for: ${nodeName}`);
    console.log(`🔗 [DEBUG] Current data nodes count: ${data.nodes.length}`);
    console.log(`🔗 [DEBUG] Current data links count: ${data.links.length}`);
    
    try {
      // Fetch the full network for this collaborator
      const url = `/api/network/${encodeURIComponent(nodeName)}`;
      console.log(`🔗 [DEBUG] Fetching from URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`🔗 [DEBUG] Response status: ${response.status}`);
      console.log(`🔗 [DEBUG] Response ok: ${response.ok}`);
      console.log(`🔗 [DEBUG] Response headers:`, Array.from(response.headers.entries()));
      
      if (response.ok) {
        const collaboratorNetwork = await response.json();
        console.log(`🔗 [DEBUG] Received collaborator network:`, collaboratorNetwork);
        console.log(`🔗 [DEBUG] Collaborator nodes count: ${collaboratorNetwork.nodes?.length || 0}`);
        console.log(`🔗 [DEBUG] Collaborator links count: ${collaboratorNetwork.links?.length || 0}`);
        
        // Merge the collaborator's network with the existing network
        const mergedNodes = [...data.nodes];
        const mergedLinks = [...data.links];
        
        // Add new nodes from collaborator's network (avoiding duplicates, limit to 3 new collaborators)
        const existingNodeIds = new Set(data.nodes.map(n => n.id));
        let addedCount = 0;
        const maxNewCollaborators = 3;
        
        collaboratorNetwork.nodes.forEach((collaboratorNode: NetworkNode) => {
          if (!existingNodeIds.has(collaboratorNode.id) && addedCount < maxNewCollaborators) {
            // Skip the main artist node (which would be the expanded node)
            if (collaboratorNode.name !== nodeName) {
              mergedNodes.push(collaboratorNode);
              existingNodeIds.add(collaboratorNode.id);
              addedCount++;
            }
          }
        });
        
        // Add new links from collaborator's network (avoiding duplicates, only for added nodes)
        const existingLinkIds = new Set(data.links.map(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return `${sourceId}-${targetId}`;
        }));
        
        // Get the IDs of all nodes in the current merged network
        const allNodeIds = new Set(mergedNodes.map(n => n.id));
        
        collaboratorNetwork.links.forEach((collaboratorLink: NetworkLink) => {
          const sourceId = typeof collaboratorLink.source === 'string' ? collaboratorLink.source : collaboratorLink.source.id;
          const targetId = typeof collaboratorLink.target === 'string' ? collaboratorLink.target : collaboratorLink.target.id;
          const linkId = `${sourceId}-${targetId}`;
          
          // Only add links where both nodes exist in our merged network
          if (!existingLinkIds.has(linkId) && allNodeIds.has(sourceId) && allNodeIds.has(targetId)) {
            mergedLinks.push(collaboratorLink);
            existingLinkIds.add(linkId);
          }
        });
        
        // Create merged network data
        const mergedNetworkData = {
          nodes: mergedNodes,
          links: mergedLinks
        };
        
        setFullNetworkData(mergedNetworkData);
        
        // Add this node to expanded set
        setExpandedNodes(prev => new Set([...Array.from(prev), nodeName]));
        setIsExpandedMode(true);
        
        console.log(`✅ Expanded network for ${nodeName} - added ${addedCount} new collaborators (max ${maxNewCollaborators})`);
      } else {
        const errorText = await response.text();
        console.error(`❌ Failed to fetch network for ${nodeName}. Status: ${response.status}, Response: ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ Error expanding network for ${nodeName}:`, error);
    }
  }, [data.nodes, data.links]);

  // Function to collapse a node's network
  const collapseNodeNetwork = useCallback((nodeName: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeName);
      return newSet;
    });
  }, []);

  // Function to reset to first-degree view
  const resetToFirstDegree = useCallback(() => {
    setFullNetworkData(null);
    setExpandedNodes(new Set());
    setIsExpandedMode(false);
    console.log(`🔄 Reset to first-degree view for ${mainArtistNode?.name || 'main artist'}`);
  }, [mainArtistNode?.name]);

  // Compute visible nodes and links
  const visibleNodes = useMemo(() => getVisibleNodes(), [getVisibleNodes]);
  const visibleLinks = useMemo(() => getVisibleLinks(), [getVisibleLinks]);

  // Get the data to display (either filtered or full)
  const displayData = useMemo(() => {
    const baseData = fullNetworkData || {
      nodes: visibleNodes,
      links: visibleLinks
    };
    
    // When in expanded mode, show all nodes from the full network data
    return isExpandedMode && fullNetworkData ? fullNetworkData : baseData;
  }, [fullNetworkData, visibleNodes, visibleLinks, isExpandedMode]);

  return {
    // State
    expandedNodes,
    fullNetworkData,
    isExpandedMode,
    
    // Computed values
    mainArtistNode,
    visibleNodes,
    visibleLinks,
    displayData,
    
    // Functions
    getFirstDegreeCollaborators,
    expandNodeNetwork,
    collapseNodeNetwork,
    resetToFirstDegree,
  };
} 