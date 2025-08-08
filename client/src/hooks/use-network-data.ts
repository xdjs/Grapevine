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

  // Function to expand a node's network (limit to at most 3 directly connected collaborators)
  const expandNodeNetwork = useCallback(async (nodeName: string, nodeId?: string) => {
    console.log(`🔗 Expanding network for: ${nodeName}`);

    try {
      const response = await fetch(`/api/network/${encodeURIComponent(nodeName)}`);
      if (!response.ok) {
        console.error(`❌ Failed to fetch network for ${nodeName}`);
        return;
      }

      const collaboratorNetwork: NetworkData = await response.json();

      // Start from the currently displayed graph (accumulate expansions)
      const baseData: NetworkData = fullNetworkData ?? { nodes: data.nodes, links: data.links };
      const mergedNodes: NetworkNode[] = [...baseData.nodes];
      const mergedLinks: NetworkLink[] = [...baseData.links];

      const existingNodeIds = new Set<string>(mergedNodes.map(n => n.id));
      const existingLinkKeys = new Set<string>(
        mergedLinks.map(l => {
          const s = typeof l.source === 'string' ? l.source : l.source.id;
          const t = typeof l.target === 'string' ? l.target : l.target.id;
          return `${s}->${t}`;
        })
      );

      // Build quick lookup for nodes returned by the collaborator network
      const returnedNodeByKey = new Map<string, NetworkNode>();
      for (const n of collaboratorNetwork.nodes) {
        returnedNodeByKey.set(n.id, n);
        if (n.name) returnedNodeByKey.set(n.name, n);
      }

      // Normalize helper
      const getId = (end: string | { id: string }) => (typeof end === 'string' ? end : end.id);

      // Determine identifiers that represent the clicked node within the collaborator network
      const clickedIdentifiers = new Set<string>();
      if (nodeName) clickedIdentifiers.add(nodeName);
      if (nodeId) clickedIdentifiers.add(nodeId);
      // Try to resolve collaborator network node id by name
      const clickedFromReturned = returnedNodeByKey.get(nodeName);
      if (clickedFromReturned) clickedIdentifiers.add(clickedFromReturned.id);

      // Find direct neighbors of the clicked node in the collaborator's network
      const neighborIds: string[] = [];
      for (const link of collaboratorNetwork.links) {
        const s = getId(link.source as any);
        const t = getId(link.target as any);
        const sIsClicked = clickedIdentifiers.has(s);
        const tIsClicked = clickedIdentifiers.has(t);
        if (sIsClicked || tIsClicked) {
          const neighborId = sIsClicked ? t : s;
          if (!neighborIds.includes(neighborId)) neighborIds.push(neighborId);
        }
      }

      // Select up to three neighbors not already present as nodes (prioritize new nodes)
      const selectedNeighborIds: string[] = [];
      for (const nid of neighborIds) {
        if (selectedNeighborIds.length >= 3) break;
        if (!existingNodeIds.has(nid)) {
          selectedNeighborIds.push(nid);
        }
      }
      // If fewer than 3 new ones, allow existing ones to ensure up to 3 visible connections
      if (selectedNeighborIds.length < 3) {
        for (const nid of neighborIds) {
          if (selectedNeighborIds.length >= 3) break;
          if (!selectedNeighborIds.includes(nid)) {
            selectedNeighborIds.push(nid);
          }
        }
      }

      // Add selected neighbor nodes (from returned data only; no fabrication)
      for (const nid of selectedNeighborIds) {
        const nodeToAdd = returnedNodeByKey.get(nid);
        if (nodeToAdd && !existingNodeIds.has(nodeToAdd.id)) {
          mergedNodes.push(nodeToAdd);
          existingNodeIds.add(nodeToAdd.id);
        }
      }

      // Add only the links that connect the clicked node to the selected neighbors
      for (const link of collaboratorNetwork.links) {
        const s = getId(link.source as any);
        const t = getId(link.target as any);
        const sIsClicked = clickedIdentifiers.has(s);
        const tIsClicked = clickedIdentifiers.has(t);
        const connectsClicked = (sIsClicked && selectedNeighborIds.includes(t)) || (tIsClicked && selectedNeighborIds.includes(s));
        if (!connectsClicked) continue;
        const key = `${s}->${t}`;
        if (!existingLinkKeys.has(key)) {
          mergedLinks.push(link);
          existingLinkKeys.add(key);
        }
      }

      const mergedNetworkData: NetworkData = { nodes: mergedNodes, links: mergedLinks };
      setFullNetworkData(mergedNetworkData);
      setExpandedNodes(prev => new Set([...prev, nodeName]));
      setIsExpandedMode(true);

      console.log(`✅ Expanded ${nodeName}: added up to 3 collaborators (actual added nodes: ${mergedNodes.length - baseData.nodes.length}, links: ${mergedLinks.length - baseData.links.length})`);
    } catch (error) {
      console.error(`❌ Error expanding network for ${nodeName}:`, error);
    }
  }, [data.nodes, data.links, fullNetworkData]);

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