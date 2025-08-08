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
    console.log(`🔗 Expanding network for: ${nodeName}`);

    try {
      // Prefer fetching by artist ID when available for accuracy
      const endpoint = nodeId
        ? `/api/network-by-id/${encodeURIComponent(nodeId)}`
        : `/api/network/${encodeURIComponent(nodeName)}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        console.error(`❌ Failed to fetch network for ${nodeName}`);
        return;
      }

      const collaboratorNetwork: { nodes: NetworkNode[]; links: NetworkLink[] } = await response.json();

      // Determine base graph to merge into (support cumulative expansions)
      const baseNodes: NetworkNode[] = fullNetworkData?.nodes ?? data.nodes;
      const baseLinks: NetworkLink[] = fullNetworkData?.links ?? data.links;

      const mergedNodes: NetworkNode[] = [...baseNodes];
      const mergedLinks: NetworkLink[] = [...baseLinks];

      // Identify the expanded node ID inside the fetched network robustly
      const fetchedMainNodeId = collaboratorNetwork.nodes.find((n) => n.size === 30)?.id
        || collaboratorNetwork.nodes.find((n) => n.id.toLowerCase() === nodeName.toLowerCase())?.id
        || nodeName;

      // Find up to three direct collaborators of the selected node from the fetched network
      const neighborIds = new Set<string>();
      collaboratorNetwork.links.forEach((link) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        if (sourceId === fetchedMainNodeId) neighborIds.add(targetId);
        if (targetId === fetchedMainNodeId) neighborIds.add(sourceId);
      });

      // Only add nodes that are not already present in the base graph
      const existingNodeIds = new Set(mergedNodes.map((n) => n.id));
      const candidates = Array.from(neighborIds).filter((id) => !existingNodeIds.has(id) && id !== nodeName);
      const selectedNeighborIds = candidates.slice(0, 3);

      // Map for quick lookup of fetched nodes
      const fetchedNodeById = new Map<string, NetworkNode>(
        collaboratorNetwork.nodes.map((n) => [n.id, n])
      );

      // Add selected neighbor nodes
      for (const neighborId of selectedNeighborIds) {
        const neighborNode = fetchedNodeById.get(neighborId);
        if (neighborNode) {
          mergedNodes.push(neighborNode);
          existingNodeIds.add(neighborId);
        }
      }

      // Add only the links between the expanded node and the selected neighbors
      const existingLinkIds = new Set(
        mergedLinks.map((link) => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return `${sourceId}->${targetId}`;
        })
      );

      collaboratorNetwork.links.forEach((link) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;

        const connectsToExpandedNode =
          (sourceId === fetchedMainNodeId && selectedNeighborIds.includes(targetId)) ||
          (targetId === fetchedMainNodeId && selectedNeighborIds.includes(sourceId));
        if (!connectsToExpandedNode) return;

        // Always connect to the base graph node ID (nodeName) to avoid capitalization mismatches
        const outSource = sourceId === fetchedMainNodeId ? nodeName : sourceId;
        const outTarget = targetId === fetchedMainNodeId ? nodeName : targetId;

        const linkKey = `${outSource}->${outTarget}`;
        const reverseKey = `${outTarget}->${outSource}`;
        if (!existingLinkIds.has(linkKey) && !existingLinkIds.has(reverseKey)) {
          mergedLinks.push({ source: outSource, target: outTarget });
          existingLinkIds.add(linkKey);
        }
      });

      // Apply merged data and mark expanded mode
      const mergedNetworkData = { nodes: mergedNodes, links: mergedLinks };
      setFullNetworkData(mergedNetworkData);
      setExpandedNodes((prev) => new Set([...prev, nodeName]));
      setIsExpandedMode(true);

      console.log(
        `✅ Expanded network for ${nodeName} - added up to ${selectedNeighborIds.length} collaborator nodes`
      );
    } catch (error) {
      console.error(`❌ Error expanding network for ${nodeName}:`, error);
    }
  }, [data, fullNetworkData]);

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