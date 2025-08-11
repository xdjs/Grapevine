import { useState, useCallback, useMemo, useRef } from 'react';
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
  const expandingNodeIdsRef = useRef<Set<string>>(new Set());

  // Verbose logging toggle (set window.__GRAPEVINE_DEBUG__ = true in console to enable)
  const isVerbose = typeof window !== 'undefined' && (window as any).__GRAPEVINE_DEBUG__ === true;
  const vlog = (...args: any[]) => { if (isVerbose) console.log(...args); };

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
    vlog(`🔗 Expanding network for: ${nodeName}`);

    try {
      const normalizeId = (v: string) => (v || '').toLowerCase();
      const getId = (end: string | { id: string }) => (typeof end === 'string' ? end : end.id);
      const undirectedKey = (a: string, b: string) => {
        const aN = normalizeId(a);
        const bN = normalizeId(b);
        return aN < bN ? `${aN}|${bN}` : `${bN}|${aN}`;
      };

      // Determine a preliminary lock key (prefer id, else name)
      const lockKey = normalizeId(nodeId || nodeName);
      if (expandingNodeIdsRef.current.has(lockKey)) {
        vlog(`⏳ Expansion already in progress for key=${lockKey}; ignoring duplicate request`);
        return;
      }
      expandingNodeIdsRef.current.add(lockKey);

      // Helper: robustly fetch collaborator network, prefer ID when available
      const fetchCollaboratorNetwork = async (): Promise<NetworkData | null> => {
        const cacheBust = `t=${Date.now()}`;

        // 1) Try by ID if provided
        if (nodeId) {
          const byIdUrl = `/api/network-by-id/${encodeURIComponent(nodeId)}?allowHallucinations=false&${cacheBust}`;
          try {
            const byIdResp = await fetch(byIdUrl, { cache: 'no-store' });
            if (byIdResp.ok) return (await byIdResp.json()) as NetworkData;
            console.warn(`⚠️ Failed fetch ${byIdUrl} -> status ${byIdResp.status}`);
          } catch (e) {
            console.warn(`⚠️ Error fetching by ID for ${nodeName}:`, e);
          }
        }

        // 2) Try to resolve ID via artist-options
        try {
          const optionsResp = await fetch(`/api/artist-options/${encodeURIComponent(nodeName)}?${cacheBust}`, { cache: 'no-store' });
          if (optionsResp.ok) {
            const optionsData = await optionsResp.json();
            const first = optionsData?.options?.[0];
            const resolvedId = first?.artistId || first?.id;
            if (resolvedId) {
              const byResolvedIdUrl = `/api/network-by-id/${encodeURIComponent(resolvedId)}?allowHallucinations=false&${cacheBust}`;
              const byResolvedIdResp = await fetch(byResolvedIdUrl, { cache: 'no-store' });
              if (byResolvedIdResp.ok) return (await byResolvedIdResp.json()) as NetworkData;
              console.warn(`⚠️ Failed fetch ${byResolvedIdUrl} -> status ${byResolvedIdResp.status}`);
            }
          }
        } catch (e) {
          console.warn(`⚠️ Error resolving artist ID for ${nodeName}:`, e);
        }

        // 3) Fallback: fetch by name (no hallucinations)
        const byNameUrl = `/api/network/${encodeURIComponent(nodeName)}?allowHallucinations=false&${cacheBust}`;
        try {
          const byNameResp = await fetch(byNameUrl, { cache: 'no-store' });
          if (byNameResp.ok) return (await byNameResp.json()) as NetworkData;
          console.warn(`⚠️ Failed fetch ${byNameUrl} -> status ${byNameResp.status}`);
        } catch (e) {
          console.warn(`⚠️ Error fetching by name for ${nodeName}:`, e);
        }

        return null;
      };

      const collaboratorNetwork = await fetchCollaboratorNetwork();
      if (!collaboratorNetwork) {
        console.error(`❌ Failed to fetch network for ${nodeName} (all strategies)`);
        // Toast: failed to fetch
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('network-toast', { detail: { message: `Could not fetch collaborators for ${nodeName}.`, type: 'error' } }));
        }
        return;
      }

      // Start from the currently VISIBLE graph (accumulate expansions)
      // If we already have an accumulated expanded graph, use it; otherwise use first-degree visible subset
      const baseData: NetworkData = fullNetworkData ?? {
        nodes: getVisibleNodes(),
        links: getVisibleLinks(),
      };
      const mergedNodes: NetworkNode[] = [...baseData.nodes];
      const mergedLinks: NetworkLink[] = [...baseData.links];

      // Early exit if this node appears to be already expanded (best-effort)
      const existingIdForName = baseData.nodes.find(n => n.name === nodeName)?.id;
      const candidateId = nodeId || existingIdForName;
      if (candidateId && expandedNodes.has(candidateId)) {
        vlog(`ℹ️ Node already expanded id=${candidateId}; skipping expansion`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('network-toast', { detail: { message: `${nodeName} is already expanded.`, type: 'info' } }));
        }
        return;
      }

      // Track existing nodes by normalized id, and links by undirected, normalized key
      const existingNodeIdsNormalized = new Set<string>(mergedNodes.map(n => normalizeId(n.id)));
      const existingLinkKeys = new Set<string>(
        mergedLinks.map(l => undirectedKey(getId(l.source), getId(l.target)))
      );

      // Build quick lookup for nodes returned by the collaborator network (case-insensitive keys)
      const returnedNodeByKey = new Map<string, NetworkNode>();
      const toKey = (v?: string) => (v || '').toLowerCase();
      for (const n of collaboratorNetwork.nodes) {
        returnedNodeByKey.set(toKey(n.id), n);
        if (n.name) returnedNodeByKey.set(toKey(n.name), n);
      }

      // Determine canonical identifier for the clicked node inside the collaborator network
      let clickedCanonicalId: string | undefined;
      // Prefer exact id match when provided
      if (nodeId && returnedNodeByKey.has(toKey(nodeId))) {
        clickedCanonicalId = nodeId;
      }
      // Fallback: match by name
      if (!clickedCanonicalId) {
        const byName = returnedNodeByKey.get(toKey(nodeName));
        if (byName) clickedCanonicalId = byName.id;
      }
      // Last resort: use provided id or name directly
      if (!clickedCanonicalId) clickedCanonicalId = nodeId || nodeName;

      // Normalize to a canonical id from returned data if possible
      const clickedCanonicalNode = returnedNodeByKey.get(toKey(clickedCanonicalId));
      const clickedCanonicalFinalId = clickedCanonicalNode?.id || clickedCanonicalId;

      // Find direct neighbors of the clicked node in the collaborator's network
      const neighborIds: string[] = [];
      for (const link of collaboratorNetwork.links) {
        const s = getId(link.source as any);
        const t = getId(link.target as any);
        if (toKey(s) === toKey(clickedCanonicalFinalId) || toKey(t) === toKey(clickedCanonicalFinalId)) {
          const neighborId = toKey(s) === toKey(clickedCanonicalFinalId) ? t : s;
          if (!neighborIds.includes(neighborId)) neighborIds.push(neighborId);
        }
      }

      // Select up to three neighbors that are NEW nodes only (do not connect to existing nodes)
      // Also filter out the main artist if present in the collaborator network
      const mainIdCandidates = [mainArtistNode?.id, mainArtistNode?.name].filter(Boolean).map(String);
      const isMain = (id: string) => mainIdCandidates.some(mid => toKey(mid) === toKey(id));
      const selectedNeighborIds: string[] = [];
      for (const nid of neighborIds) {
        if (selectedNeighborIds.length >= 3) break;
        if (isMain(nid)) continue;
        if (!existingNodeIdsNormalized.has(normalizeId(nid))) {
          selectedNeighborIds.push(nid);
        }
      }

      // If no new neighbors found, notify and exit gracefully
      if (selectedNeighborIds.length === 0) {
        vlog(`ℹ️ No new neighbors found to add for ${nodeName}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('network-toast', { detail: { message: `No new collaborators found for ${nodeName}.`, type: 'info' } }));
        }
        return;
      }

      // Add selected neighbor nodes (from returned data only; no fabrication)
      for (const nid of selectedNeighborIds) {
        const nodeToAdd = returnedNodeByKey.get(toKey(nid));
        if (nodeToAdd && !existingNodeIdsNormalized.has(normalizeId(nodeToAdd.id))) {
          mergedNodes.push(nodeToAdd);
          existingNodeIdsNormalized.add(normalizeId(nodeToAdd.id));
          vlog(`➕ [Expand] Added node: ${nodeToAdd.name} (id=${nodeToAdd.id})`);
        }
      }

      // Add only the links that connect the clicked node to the selected NEW neighbors
      for (const link of collaboratorNetwork.links) {
        const s = getId(link.source as any);
        const t = getId(link.target as any);
        const connectsClicked = (toKey(s) === toKey(clickedCanonicalFinalId) && selectedNeighborIds.map(toKey).includes(toKey(t))) ||
                               (toKey(t) === toKey(clickedCanonicalFinalId) && selectedNeighborIds.map(toKey).includes(toKey(s)));
        if (!connectsClicked) continue;
        // Map to canonical ids from returned data when possible, then normalize undirected
        const sCanon = returnedNodeByKey.get(toKey(s))?.id || s;
        const tCanon = returnedNodeByKey.get(toKey(t))?.id || t;
        const key = undirectedKey(sCanon, tCanon);
        if (!existingLinkKeys.has(key)) {
          mergedLinks.push({ source: sCanon, target: tCanon });
          existingLinkKeys.add(key);
          vlog(`➕ [Expand] Added link: ${sCanon} -- ${tCanon}`);
        }
      }

      const mergedNetworkData: NetworkData = { nodes: mergedNodes, links: mergedLinks };
      setFullNetworkData(mergedNetworkData);
      setExpandedNodes(prev => new Set([...prev, clickedCanonicalFinalId]));
      setIsExpandedMode(true);

      const addedNodeCount = mergedNodes.length - baseData.nodes.length;
      const addedLinkCount = mergedLinks.length - baseData.links.length;
      const neighborNames = selectedNeighborIds
        .map(id => returnedNodeByKey.get(toKey(id))?.name || id)
        .slice(0, 3);
      vlog(`✅ Expanded ${nodeName} [canonicalId=${clickedCanonicalFinalId}]: added up to 3 collaborators -> [${neighborNames.join(', ')}] (nodes: ${addedNodeCount}, links: ${addedLinkCount})`);

      // Toast: success or no new neighbors
      if (typeof window !== 'undefined') {
        if (addedNodeCount === 0 && addedLinkCount === 0) {
          window.dispatchEvent(new CustomEvent('network-toast', { detail: { message: `No new collaborators found for ${nodeName}.`, type: 'info' } }));
        } else {
          window.dispatchEvent(new CustomEvent('network-toast', { detail: { message: `Expanded ${nodeName} with up to 3 collaborators.`, type: 'success' } }));
        }
      }
    } catch (error) {
      console.error(`❌ Error expanding network for ${nodeName}:`, error);
    } finally {
      // Release the lock
      const lockKey = (nodeId || nodeName || '').toLowerCase();
      expandingNodeIdsRef.current.delete(lockKey);
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