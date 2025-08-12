import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { NetworkData, NetworkNode, NetworkLink } from '@/types/network';

interface UseNetworkDataProps {
  data: NetworkData;
}

interface UseNetworkDataReturn {
  // State
  expandedNodes: Set<string>;
  fullNetworkData: NetworkData | null;
  isExpandedMode: boolean;
  rehydrateReady: boolean;
  
  // Computed values
  mainArtistNode: NetworkNode | undefined;
  visibleNodes: NetworkNode[];
  visibleLinks: NetworkLink[];
  displayData: NetworkData;
  
  // Functions
  getFirstDegreeCollaborators: () => Set<string>;
  expandNodeNetwork: (nodeName: string, nodeId?: string) => Promise<void>;
  collapseNodeNetwork: (nodeName: string, nodeId?: string) => void;
  resetToFirstDegree: () => void;
  isNodeExpanded: (nodeId?: string, nodeName?: string) => boolean;
}

export function useNetworkData({ data }: UseNetworkDataProps): UseNetworkDataReturn {
  // State for managing expanded networks
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [fullNetworkData, setFullNetworkData] = useState<NetworkData | null>(null);
  const [isExpandedMode, setIsExpandedMode] = useState(false);
  const expandingNodeIdsRef = useRef<Set<string>>(new Set());
  const [rehydrateReady, setRehydrateReady] = useState(false);
  // Track base (first-degree) graph when entering expanded mode
  const baseGraphRef = useRef<NetworkData | null>(null);
  // Track per-node contributions so we can surgically remove them later
  type Contribution = { addedNodeIds: Set<string>; addedLinkKeys: Set<string>; neighborIds: Set<string> };
  const contributionsRef = useRef<Map<string, Contribution>>(new Map());
  const PERSIST_KEY = 'gv_expanded_state_v1';

  declare global {
    interface Window { grapevineExpandedState?: any }
  }

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

      // Start from the best available expanded snapshot
      // Priority: in-memory expanded graph > persisted expanded snapshot > visible first-degree subset
      let baseData: NetworkData | null = fullNetworkData ?? null;
      if (!baseData) {
        try {
          const currentMain = mainArtistNode?.name || '';
          let saved: any = undefined;
          if (typeof window !== 'undefined' && (window as any).grapevineExpandedState) {
            saved = (window as any).grapevineExpandedState;
          }
          if (!saved) {
            const raw = sessionStorage.getItem(PERSIST_KEY);
            saved = raw ? JSON.parse(raw) : undefined;
          }
          if (saved && saved.main === currentMain && saved.isExpandedMode && Array.isArray(saved.fullNetworkData?.nodes) && saved.fullNetworkData.nodes.length > 0) {
            baseData = saved.fullNetworkData as NetworkData;
            vlog(`[ExpandPersist] expand base from saved snapshot nodes=${baseData.nodes.length}`);
          }
        } catch {}
      }
      if (!baseData) {
        baseData = {
          nodes: getVisibleNodes(),
          links: getVisibleLinks(),
        };
      }
      if (!fullNetworkData && !baseGraphRef.current) {
        baseGraphRef.current = baseData;
      }
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

      // Fast lookup of existing/base nodes by case-insensitive keys (id and name)
      const existingNodeByKey = new Map<string, NetworkNode>();
      const keyify = (s?: string) => (s || '').toLowerCase();
      for (const n of mergedNodes) {
        existingNodeByKey.set(keyify(n.id), n);
        if (n.name) existingNodeByKey.set(keyify(n.name), n);
      }

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

      // Normalize to a canonical id present in the merged/base graph if possible
      const getCanonicalId = (raw: string) => {
        const fromReturned = returnedNodeByKey.get(toKey(raw))?.id;
        if (fromReturned && existingNodeByKey.has(keyify(fromReturned))) {
          return existingNodeByKey.get(keyify(fromReturned))!.id;
        }
        if (existingNodeByKey.has(keyify(raw))) return existingNodeByKey.get(keyify(raw))!.id;
        return fromReturned || raw;
      };

      const clickedCanonicalFinalId = getCanonicalId(clickedCanonicalId);

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
      const addedNodeIdsForThisExpansion = new Set<string>();
      const neighborIdsForThisExpansion = new Set<string>();
      for (const nid of selectedNeighborIds) {
        const nodeToAdd = returnedNodeByKey.get(toKey(nid));
        if (nodeToAdd && !existingNodeIdsNormalized.has(normalizeId(nodeToAdd.id))) {
          mergedNodes.push(nodeToAdd);
          existingNodeIdsNormalized.add(normalizeId(nodeToAdd.id));
          existingNodeByKey.set(keyify(nodeToAdd.id), nodeToAdd);
          if (nodeToAdd.name) existingNodeByKey.set(keyify(nodeToAdd.name), nodeToAdd);
          vlog(`➕ [Expand] Added node: ${nodeToAdd.name} (id=${nodeToAdd.id})`);
          addedNodeIdsForThisExpansion.add(nodeToAdd.id);
        }
      }

      // Add only the links that connect the clicked node to the selected NEW neighbors
      const addedLinkKeysForThisExpansion = new Set<string>();
      for (const link of collaboratorNetwork.links) {
        const s = getId(link.source as any);
        const t = getId(link.target as any);
        const connectsClicked = (toKey(s) === toKey(clickedCanonicalFinalId) && selectedNeighborIds.map(toKey).includes(toKey(t))) ||
                               (toKey(t) === toKey(clickedCanonicalFinalId) && selectedNeighborIds.map(toKey).includes(toKey(s)));
        if (!connectsClicked) continue;
        // Map to canonical ids present in merged/base graph when possible, then normalize undirected
        const sCanon = getCanonicalId(s);
        const tCanon = getCanonicalId(t);
        const key = undirectedKey(sCanon, tCanon);
        if (!existingLinkKeys.has(key)) {
          mergedLinks.push({ source: sCanon, target: tCanon });
          existingLinkKeys.add(key);
          vlog(`➕ [Expand] Added link: ${sCanon} -- ${tCanon}`);
          addedLinkKeysForThisExpansion.add(key);
          // Track selected neighbors canonically
          const neighborCanon = toKey(sCanon) === toKey(clickedCanonicalFinalId) ? tCanon : sCanon;
          neighborIdsForThisExpansion.add(neighborCanon);
        }
      }

      const mergedNetworkData: NetworkData = { nodes: mergedNodes, links: mergedLinks };
      setFullNetworkData(mergedNetworkData);
      setExpandedNodes(prev => new Set([...prev, clickedCanonicalFinalId]));
      setIsExpandedMode(true);
      // Record contribution for surgical shrink
      // Merge contributions instead of overwriting to preserve previous expansions
      const prev = contributionsRef.current.get(clickedCanonicalFinalId);
      if (prev) {
        addedNodeIdsForThisExpansion.forEach(id => prev.addedNodeIds.add(id));
        addedLinkKeysForThisExpansion.forEach(k => prev.addedLinkKeys.add(k));
        neighborIdsForThisExpansion.forEach(n => prev.neighborIds.add(n));
      } else {
        contributionsRef.current.set(clickedCanonicalFinalId, {
          addedNodeIds: addedNodeIdsForThisExpansion,
          addedLinkKeys: addedLinkKeysForThisExpansion,
          neighborIds: neighborIdsForThisExpansion,
        });
      }

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

  // Function to surgically collapse a node's expansion
  const collapseNodeNetwork = useCallback((nodeName: string, nodeId?: string) => {
    if (!fullNetworkData) return;
    const toKey = (v?: string) => (v || '').toLowerCase();
    // Find the contribution key (canonical id) for this node
    let keyToRemove: string | undefined;
    if (nodeId) {
      // Prefer id match; also try case-insensitive match if keys differ by case
      const direct = contributionsRef.current.has(nodeId) ? nodeId : undefined;
      if (!direct) {
        for (const k of contributionsRef.current.keys()) {
          if (toKey(k) === toKey(nodeId)) { keyToRemove = k; break; }
        }
      } else {
        keyToRemove = direct;
      }
    } else {
      // Match by name against keys
      for (const k of contributionsRef.current.keys()) {
        if (toKey(k) === toKey(nodeName)) { keyToRemove = k; break; }
      }
    }
    if (!keyToRemove) return;

    const contribution = contributionsRef.current.get(keyToRemove);
    if (!contribution) return;

    // Build preservation set: nodes that belong to other expansions (anchors and their added nodes)
    const preserveNodeIds = new Set<string>();
    contributionsRef.current.forEach((c, k) => {
      if (k === keyToRemove) return;
      preserveNodeIds.add(k); // other expansion anchors
      c.addedNodeIds.forEach(id => preserveNodeIds.add(id));
    });

    // Remove contributed links, but preserve links that keep other expansions attached
    const remainingLinks = fullNetworkData.links.filter(l => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      const key = (s.toLowerCase() < t.toLowerCase()) ? `${s.toLowerCase()}|${t.toLowerCase()}` : `${t.toLowerCase()}|${s.toLowerCase()}`;
      if (!contribution.addedLinkKeys.has(key)) return true;
      // Preserve if this link connects to nodes belonging to other expansions
      if (preserveNodeIds.has(s) || preserveNodeIds.has(t)) return true;
      return false;
    });

    // Build keep sets
    const baseNodeIds = new Set<string>((baseGraphRef.current?.nodes || []).map(n => n.id));
    const otherContributionNodeIds = new Set<string>();
    contributionsRef.current.forEach((c, k) => {
      if (k === keyToRemove) return;
      c.addedNodeIds.forEach(id => otherContributionNodeIds.add(id));
    });
    // Compute nodes still attached via remaining links
    const attachedNodeIds = new Set<string>();
    for (const l of remainingLinks) {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      attachedNodeIds.add(s);
      attachedNodeIds.add(t);
    }

    // Remove nodes that were added by this contribution and are no longer referenced elsewhere
    const remainingNodes = fullNetworkData.nodes.filter(n => {
      // Keep base and other contributions explicitly
      if (baseNodeIds.has(n.id)) return true;
      if (otherContributionNodeIds.has(n.id)) return true;
      // If this node was a neighbor added by this expansion, remove it and anything exclusively under it
      if (contribution.addedNodeIds.has(n.id) || contribution.neighborIds.has(n.id)) {
        if (!attachedNodeIds.has(n.id)) return false; // dangling
        // If still attached, keep it
        return true;
      }
      // Nodes we didn't add are kept
      return true;
    });

    const nextData: NetworkData = { nodes: remainingNodes, links: remainingLinks };
    setFullNetworkData(nextData);

    // Update expanded sets/maps
    const newExpanded = new Set(expandedNodes);
    newExpanded.delete(keyToRemove);
    setExpandedNodes(newExpanded);
    contributionsRef.current.delete(keyToRemove);

    // If no expansions remain, exit expanded mode and return to base
    if (contributionsRef.current.size === 0) {
      setIsExpandedMode(false);
      setFullNetworkData(null);
      baseGraphRef.current = null;
    }
  }, [expandedNodes, fullNetworkData]);

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

  const isNodeExpanded = useCallback((nodeId?: string, nodeName?: string) => {
    const toKey = (v?: string) => (v || '').toLowerCase();
    // Prefer contribution-based determination: expanded if we recorded any nodes/links added for this anchor
    if (contributionsRef.current.size > 0) {
      // Exact id match
      if (nodeId && contributionsRef.current.has(nodeId)) {
        const c = contributionsRef.current.get(nodeId)!;
        return (c.addedNodeIds.size > 0) || (c.addedLinkKeys.size > 0);
      }
      // Case-insensitive id match
      if (nodeId) {
        for (const [k, c] of contributionsRef.current.entries()) {
          if (toKey(k) === toKey(nodeId)) {
            return (c.addedNodeIds.size > 0) || (c.addedLinkKeys.size > 0);
          }
        }
      }
      // Name match
      if (nodeName) {
        for (const [k, c] of contributionsRef.current.entries()) {
          if (toKey(k) === toKey(nodeName)) {
            return (c.addedNodeIds.size > 0) || (c.addedLinkKeys.size > 0);
          }
        }
      }
    }
    // Fallback to set-based heuristic
    if (nodeId && expandedNodes.has(nodeId)) return true;
    for (const k of expandedNodes) {
      if (toKey(k) === toKey(nodeId)) return true;
    }
    if (nodeName && expandedNodes.has(nodeName)) return true;
    for (const k of expandedNodes) {
      if (toKey(k) === toKey(nodeName)) return true;
    }
    return false;
  }, [expandedNodes]);

  // Get the data to display (either filtered or full)
  const displayData = useMemo(() => {
    // If expanded state not in React yet, but a saved snapshot exists for this artist, prefer it
    try {
      if (!isExpandedMode && !fullNetworkData && typeof window !== 'undefined') {
        const saved = (window as any).grapevineExpandedState || (sessionStorage.getItem(PERSIST_KEY) ? JSON.parse(sessionStorage.getItem(PERSIST_KEY) as string) : null);
        const currentMain = mainArtistNode?.name || '';
        if (saved && saved.main === currentMain && saved.isExpandedMode && Array.isArray(saved.fullNetworkData?.nodes) && saved.fullNetworkData.nodes.length > 0) {
          console.log(`[ExpandPersist] displayData using saved snapshot nodes=${saved.fullNetworkData.nodes.length}`);
          return saved.fullNetworkData as NetworkData;
        }
      }
    } catch {}

    const baseData = fullNetworkData || {
      nodes: visibleNodes,
      links: visibleLinks
    };
    
    // When in expanded mode, show all nodes from the full network data
    return isExpandedMode && fullNetworkData ? fullNetworkData : baseData;
  }, [fullNetworkData, visibleNodes, visibleLinks, isExpandedMode]);

  // Persist expanded state to sessionStorage to survive tab switches/remounts
  useEffect(() => {
    try {
      const logState = (where: string) => {
        const count = fullNetworkData?.nodes?.length ?? 0;
        console.log(`[ExpandPersist] save@${where} main="${mainArtistNode?.name || ''}" expanded=${isExpandedMode} nodes=${count} expandedSet=${expandedNodes.size}`);
      };
      const mainName = mainArtistNode?.name || '';
      const payload = {
        main: mainName,
        isExpandedMode,
        fullNetworkData,
        expandedNodes: Array.from(expandedNodes),
        baseGraph: baseGraphRef.current,
        contributions: Array.from(contributionsRef.current.entries()).map(([k, v]) => ({
          key: k,
          addedNodeIds: Array.from(v.addedNodeIds),
          addedLinkKeys: Array.from(v.addedLinkKeys),
          neighborIds: Array.from(v.neighborIds || []),
        })),
      };
      // Decide if we should overwrite saved state. Never overwrite an existing expanded state with a collapsed one.
      let existing: any = undefined;
      if (typeof window !== 'undefined' && window.grapevineExpandedState) existing = window.grapevineExpandedState;
      if (!existing) {
        const raw = sessionStorage.getItem(PERSIST_KEY);
        existing = raw ? JSON.parse(raw) : undefined;
      }
      const currentCount = payload.fullNetworkData?.nodes?.length ?? 0;
      const existingCount = existing?.fullNetworkData?.nodes?.length ?? 0;
      const sameMain = existing && existing.main === mainName;
      const existingExpanded = Boolean(existing?.isExpandedMode);
      const shouldPersist = () => {
        if (!mainName) return false;
        if (isExpandedMode && currentCount > 0) return true;
        if (!existing) return true;
        if (!sameMain) return true;
        if (existingExpanded) return false; // keep expanded snapshot
        // Both collapsed; avoid thrashing saved state
        return false;
      };
      if (shouldPersist()) {
        if (typeof window !== 'undefined') {
          window.grapevineExpandedState = payload;
          logState('memory');
        }
        sessionStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
        logState('session');
      } else {
        console.log('[ExpandPersist] skip-save (preserve existing expanded state)');
      }
    } catch {}
  }, [isExpandedMode, fullNetworkData, expandedNodes, mainArtistNode?.name]);

  // Rehydrate on mount if same main artist (sync before first paint to avoid flicker/reset)
  useLayoutEffect(() => {
    // Wait until base data is present and main artist identified
    if (!mainArtistNode || !Array.isArray(data?.nodes) || data.nodes.length === 0) return;
    try {
      let saved: any = undefined;
      if (typeof window !== 'undefined' && window.grapevineExpandedState) {
        saved = window.grapevineExpandedState;
        console.log('[ExpandPersist] rehydrate source=memory');
      }
      if (!saved) {
        const raw = sessionStorage.getItem(PERSIST_KEY);
        saved = raw ? JSON.parse(raw) : undefined;
        if (saved) console.log('[ExpandPersist] rehydrate source=session');
        else console.log('[ExpandPersist] rehydrate source=none');
      }
      const currentMain = mainArtistNode?.name || '';
      if (!saved || saved.main !== currentMain) return;
      // Validate saved data before applying
      const valid = saved.fullNetworkData &&
        Array.isArray(saved.fullNetworkData.nodes) && saved.fullNetworkData.nodes.length > 0 &&
        Array.isArray(saved.fullNetworkData.links) &&
        Array.isArray(saved.expandedNodes) &&
        // Saved expansion should be at least as large as initial graph
        (Array.isArray(data?.nodes) ? saved.fullNetworkData.nodes.length >= data.nodes.length : true);
      if (!valid) return;
      if (saved.isExpandedMode) {
        setFullNetworkData(saved.fullNetworkData);
        setIsExpandedMode(true);
        console.log(`[ExpandPersist] applied nodes=${saved.fullNetworkData.nodes.length} links=${saved.fullNetworkData.links?.length ?? 0}`);
      }
      if (Array.isArray(saved.expandedNodes)) {
        setExpandedNodes(new Set<string>(saved.expandedNodes));
      }
      if (saved.baseGraph) {
        baseGraphRef.current = saved.baseGraph;
      }
      if (Array.isArray(saved.contributions)) {
        const map = new Map<string, Contribution>();
        for (const c of saved.contributions) {
          map.set(String(c.key), {
            addedNodeIds: new Set<string>(c.addedNodeIds || []),
            addedLinkKeys: new Set<string>(c.addedLinkKeys || []),
            neighborIds: new Set<string>(c.neighborIds || []),
          });
        }
        contributionsRef.current = map;
      }
    } catch {}
    finally {
      setRehydrateReady(true);
    }
  }, [mainArtistNode?.name, data?.nodes?.length]);

  // Only clear expansions when the main artist actually changes (not on visibility/tab switches)
  const prevMainRef = useRef<string | null>(null);
  useEffect(() => {
    const currentMain = mainArtistNode?.name || null;
    if (currentMain && prevMainRef.current && prevMainRef.current !== currentMain) {
      setFullNetworkData(null);
      setIsExpandedMode(false);
      setExpandedNodes(new Set());
      contributionsRef.current.clear();
      baseGraphRef.current = null;
      try { sessionStorage.removeItem(PERSIST_KEY); } catch {}
      console.log('[ExpandPersist] cleared due to main artist change');
    }
    prevMainRef.current = currentMain;
  }, [mainArtistNode?.name]);

  // Visibility change log
  useEffect(() => {
    const onVis = () => {
      const cnt = fullNetworkData?.nodes?.length ?? 0;
      console.log(`[ExpandPersist] visibility=${document.visibilityState} expanded=${isExpandedMode} nodes=${cnt}`);
      if (document.visibilityState === 'visible') {
        try {
          // Attempt soft rehydrate if we have a stronger saved snapshot
          const currentMain = mainArtistNode?.name || '';
          let saved: any = undefined;
          if (typeof window !== 'undefined' && window.grapevineExpandedState) saved = window.grapevineExpandedState;
          if (!saved) {
            const raw = sessionStorage.getItem(PERSIST_KEY);
            saved = raw ? JSON.parse(raw) : undefined;
          }
          const savedCount = saved?.fullNetworkData?.nodes?.length ?? 0;
          if (saved && saved.main === currentMain && saved.isExpandedMode && savedCount > cnt) {
            setFullNetworkData(saved.fullNetworkData);
            setIsExpandedMode(true);
            if (Array.isArray(saved.expandedNodes)) setExpandedNodes(new Set<string>(saved.expandedNodes));
            console.log(`[ExpandPersist] re-applied on visible nodes=${savedCount}`);
          }
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isExpandedMode, fullNetworkData?.nodes?.length, mainArtistNode?.name]);

  return {
    // State
    expandedNodes,
    fullNetworkData,
    isExpandedMode,
    rehydrateReady,
    
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
    isNodeExpanded,
  };
} 