import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { NetworkNode, NetworkData } from '@/types/network';

export interface TooltipPosition {
  x: number;
  y: number;
}

export interface TooltipConfig {
  musicNerdBaseUrl: string;
  getFreshConfig: () => Promise<{ musicNerdBaseUrl: string } | null>;
}

export interface TooltipNetworkDataHook {
  finalDisplayData: NetworkData;
  expandNodeNetwork: (artistName: string, artistId?: string) => Promise<void>;
}

export interface TooltipCallbacks {
  onArtistNodeClick?: (artistName: string, artistId?: string) => void;
  onShowArtistModal: (artistName: string) => void;
  onShowCollaborationPopup: (data: {
    artist: string;
    collaborator: string;
    mainArtistName: string;
  }) => void;
}

export interface UseTooltipParams {
  networkData: NetworkData;
  config: TooltipConfig;
  networkDataHook: TooltipNetworkDataHook;
  callbacks: TooltipCallbacks;
}

export interface UseTooltipReturn {
  // State
  isTooltipVisible: boolean;
  tooltipPosition: TooltipPosition;
  highlightedNode: d3.Selection<SVGGElement, unknown, null, undefined> | null;
  currentNode: NetworkNode | null;
  
  // Core functions
  showTooltip: (event: MouseEvent, node: NetworkNode) => void;
  hideTooltip: () => void;
  moveTooltip: (event: MouseEvent) => void;
  positionTooltipNearNode: (nodeEl: SVGGElement) => void;
  
  // Node highlighting
  setHighlightedNode: (node: d3.Selection<SVGGElement, unknown, null, undefined> | null) => void;
  resetNodeHighlight: () => void;
  
  // Action handlers
  handleNetworkAction: (node: NetworkNode) => Promise<void>;
  handleExpandAction: (node: NetworkNode) => Promise<void>;
  handleProfileAction: (node: NetworkNode) => Promise<void>;
  handleCollaborationAction: (node: NetworkNode, mainArtist?: NetworkNode) => void;
  
  
}

export function useTooltip({
  networkData,
  config,
  networkDataHook,
  callbacks,
}: UseTooltipParams): UseTooltipReturn {
  // State management
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const [highlightedNode, setHighlightedNode] = useState<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const [currentNode, setCurrentNode] = useState<NetworkNode | null>(null);
  
  // Remove D3 tooltip implementation - using React NetworkTooltip component instead

  // Calculate tooltip position with boundary detection
  const calculatePosition = useCallback((event: MouseEvent): TooltipPosition => {
    const isMobile = window.innerWidth <= 768;
    
    // Use standard tooltip dimensions since we're using React component
    const tooltipWidth = isMobile ? 320 : 380; // matches NetworkTooltip maxWidth
    const tooltipHeight = isMobile ? 200 : 250; // estimated height
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = event.pageX + 10;
    let top = event.pageY - 10;
    
    // Adjust for mobile - center the tooltip more and avoid edges
    if (isMobile) {
      // On mobile, try to center the tooltip horizontally
      left = Math.max(10, Math.min(viewportWidth - tooltipWidth - 10, event.pageX - tooltipWidth / 2));
      
      // On mobile, position tooltip above the click point if there's space, otherwise below
      if (event.pageY - tooltipHeight - 20 > 0) {
        top = event.pageY - tooltipHeight - 20; // Above the click point
      } else {
        top = event.pageY + 20; // Below the click point
      }
    } else {
      // Desktop positioning with boundary checks
      if (left + tooltipWidth > viewportWidth - 10) {
        left = event.pageX - tooltipWidth - 10; // Position to the left instead
      }
      
      if (top + tooltipHeight > viewportHeight - 10) {
        top = event.pageY - tooltipHeight - 10; // Position above instead
      }
    }
    
    // Final boundary checks
    left = Math.max(10, Math.min(viewportWidth - tooltipWidth - 10, left));
    top = Math.max(10, Math.min(viewportHeight - tooltipHeight - 10, top));
    
    return { x: left, y: top };
  }, []);

  // Core tooltip functions
  const showTooltip = useCallback((event: MouseEvent, node: NetworkNode) => {
    const position = calculatePosition(event);
    setTooltipPosition(position);
    setIsTooltipVisible(true);
    setCurrentNode(node);
  }, [calculatePosition]);

  // Node highlighting functions
  const resetNodeHighlight = useCallback(() => {
    if (highlightedNode) {
      const nodeData = highlightedNode.datum() as NetworkNode;
      const roles = nodeData.types || [nodeData.type];
      
      console.log(`🎨 Resetting highlight for node: ${nodeData.name} with roles: [${roles.join(', ')}]`);
      
      // Reset to original styling based on node type
      if (roles.length === 1) {
        // Single role - reset to original stroke color and width
        highlightedNode.selectAll('circle')
          .attr('stroke', () => {
            if (roles[0] === 'artist') return '#FF0ACF';       // Magenta Pink
            if (roles[0] === 'producer') return '#AE53FF';     // Bright Purple  
            if (roles[0] === 'songwriter') return '#67D1F8';   // Light Blue
            return '#355367';  // Police Blue
          })
          .attr('stroke-width', 4);
      } else {
        // Multiple roles - reset path strokes to white and inner circle to white
        highlightedNode.selectAll('path')
          .attr('stroke', 'white')
          .attr('stroke-width', 1);
        
        highlightedNode.selectAll('circle')
          .attr('stroke', 'white')
          .attr('stroke-width', 2);
      }
      
      console.log(`🎨 Node ${nodeData.name} reset to original colors`);
      setHighlightedNode(null);
    }
  }, [highlightedNode]);

  const hideTooltip = useCallback(() => {
    setIsTooltipVisible(false);
    setCurrentNode(null);
    resetNodeHighlight();
  }, [resetNodeHighlight]);

  const moveTooltip = useCallback((event: MouseEvent) => {
    const position = calculatePosition(event);
    setTooltipPosition(position);
  }, [calculatePosition]);

  const positionTooltipNearNode = useCallback((nodeEl: SVGGElement) => {
    const rect = nodeEl.getBoundingClientRect();
    const pageX = rect.right + 12; // 12px to the right of node
    const pageY = rect.top + window.scrollY - 10; // align vertically

    const position = { x: pageX, y: pageY };
    setTooltipPosition(position);
  }, []);

  // Action handlers
  const handleNetworkAction = useCallback(async (node: NetworkNode) => {
    let artistId = node.artistId;
    
    // If no artist ID, try to look it up via the artist options API
    if (!artistId) {
      console.log(`🔗 No artistId for ${node.name}, attempting lookup...`);
      try {
        const response = await fetch(`/api/artist-options/${encodeURIComponent(node.name)}`);
        const data = await response.json();
        
        if (data.options && data.options.length > 0) {
          // Use the first matching artist's ID
          artistId = data.options[0].artistId || data.options[0].id;
          console.log(`🔗 Found artistId for ${node.name}: ${artistId}`);
        }
      } catch (error) {
        console.error(`🔗 Error looking up artist ID for ${node.name}:`, error);
      }
    }
    
    // Call the callback to load the artist's network within the app
    if (callbacks.onArtistNodeClick) {
      console.log(`🔗 Loading ${node.name}'s network within the app`);
      callbacks.onArtistNodeClick(node.name, artistId);
    } else {
      console.warn(`🔗 No onArtistNodeClick callback provided for ${node.name}`);
      alert(`Sorry, ${node.name} is not available in the network yet. They may be added in future updates!`);
    }
    
    hideTooltip();
  }, [callbacks.onArtistNodeClick, hideTooltip]);

  const handleExpandAction = useCallback(async (node: NetworkNode) => {
    console.log(`🔗 Expanding network for ${node.name}`);
    await networkDataHook.expandNodeNetwork(node.name, node.artistId);
    hideTooltip();
  }, [networkDataHook.expandNodeNetwork, hideTooltip]);

  const handleProfileAction = useCallback(async (node: NetworkNode) => {
    console.log(`🎵 [Frontend] openMusicNerdProfile called for "${node.name}" with artistId: ${node.artistId}`);
    
    let artistId = node.artistId;
    
    // If no specific artist ID provided, check for multiple options
    if (!artistId) {
      console.log(`🎵 [Frontend] No artistId provided, checking for multiple options`);
      
      try {
        const response = await fetch(`/api/artist-options/${encodeURIComponent(node.name)}`);
        const data = await response.json();
        
        if (data.options && data.options.length > 1) {
          // Multiple artists found - show selection modal
          console.log(`🎵 Multiple artists found for "${node.name}", showing selection modal`);
          callbacks.onShowArtistModal(node.name);
          hideTooltip();
          return;
        } else if (data.options && data.options.length === 1) {
          // Single artist found - use its ID
          artistId = data.options[0].artistId || data.options[0].id;
          console.log(`🎵 Single artist found for "${node.name}": ${artistId}`);
        }
      } catch (error) {
        console.error(`Error fetching artist options for "${node.name}":`, error);
      }
    } else {
      console.log(`🎵 [Frontend] artistId provided (${artistId}), skipping lookup and going directly to page`);
    }
    
    // Get the current base URL using the config hook
    const freshConfig = await config.getFreshConfig();
    const baseUrl = freshConfig?.musicNerdBaseUrl || config.musicNerdBaseUrl;
    
    if (!baseUrl) {
      console.error(`🎵 Cannot open MusicNerd profile for "${node.name}": Base URL not configured`);
      hideTooltip();
      return;
    }
    
    // Use artist ID if available, otherwise go to main page
    let musicNerdUrl = baseUrl;
    
    if (artistId) {
      musicNerdUrl = `${baseUrl}/artist/${artistId}`;
      console.log(`🎵 Opening MusicNerd artist page for "${node.name}": ${musicNerdUrl}`);
    } else {
      console.log(`🎵 No artist ID found for "${node.name}", opening main MusicNerd page`);
    }
    
    // Try multiple approaches to open the link
    try {
      // Method 1: window.open (most reliable for user-initiated actions)
      const newWindow = window.open(musicNerdUrl, '_blank', 'noopener,noreferrer');
      
      // Method 2: Fallback to link click if window.open fails
      if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
        console.log('🎵 Window.open blocked, trying link click method...');
        const link = document.createElement('a');
        link.href = musicNerdUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        console.log('🎵 Successfully opened new window');
      }
    } catch (error) {
      console.error('🎵 Error opening MusicNerd page:', error);
      // Final fallback: copy URL to clipboard and notify user
      if (navigator.clipboard) {
        navigator.clipboard.writeText(musicNerdUrl).then(() => {
          alert(`Unable to open page automatically. URL copied to clipboard: ${musicNerdUrl}`);
        }).catch(() => {
          alert(`Please visit: ${musicNerdUrl}`);
        });
      } else {
        alert(`Please visit: ${musicNerdUrl}`);
      }
    }
    
    hideTooltip();
  }, [config, callbacks.onShowArtistModal, hideTooltip]);

  const handleCollaborationAction = useCallback((node: NetworkNode, mainArtist?: NetworkNode) => {
    // Check if this is the main artist or a collaborator
    const mainArtistNode = mainArtist || networkData.nodes.find(n => n.size === 30 && n.type === 'artist');
    const isMainArtist = node === mainArtistNode;
    
    if (isMainArtist) {
      // For main artist, show collaboration details with themselves (empty)
      callbacks.onShowCollaborationPopup({
        artist: node.name,
        collaborator: node.name,
        mainArtistName: node.name,
      });
    } else {
      // For collaborators, find the direct connection to determine the relationship
      const mainArtistName = mainArtistNode?.name || "";
      
      // Check if the clicked node is directly connected to main artist (first layer)
      const isFirstLayer = networkDataHook.finalDisplayData.links.some(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return (sourceId === mainArtistName && targetId === node.name) || 
               (sourceId === node.name && targetId === mainArtistName);
      });
      
      if (isFirstLayer) {
        // First layer: clicked node is directly connected to main artist
        // Show collaboration between clicked node and main artist
        callbacks.onShowCollaborationPopup({
          artist: mainArtistName,
          collaborator: node.name,
          mainArtistName,
        });
      } else {
        // Second layer: clicked node is not directly connected to main artist
        // Find the first layer node that this second layer node is connected to
        const directLink = networkDataHook.finalDisplayData.links.find(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return (sourceId === node.name && targetId !== mainArtistName) || 
                 (targetId === node.name && sourceId !== mainArtistName);
        });
        
        if (directLink) {
          const connectedNodeId = directLink.source === node.name ? 
            (typeof directLink.target === 'string' ? directLink.target : directLink.target.id) :
            (typeof directLink.source === 'string' ? directLink.source : directLink.source.id);
          
          // Show collaboration between clicked node and their direct connection
          callbacks.onShowCollaborationPopup({
            artist: connectedNodeId,
            collaborator: node.name,
            mainArtistName,
          });
        } else {
          // Fallback: direct connection to main artist
          callbacks.onShowCollaborationPopup({
            artist: mainArtistName,
            collaborator: node.name,
            mainArtistName,
          });
        }
      }
    }
    
    hideTooltip();
  }, [networkData, networkDataHook.finalDisplayData, callbacks.onShowCollaborationPopup, hideTooltip]);

  return {
    // State
    isTooltipVisible,
    tooltipPosition,
    highlightedNode,
    currentNode,
    
    // Core functions
    showTooltip,
    hideTooltip,
    moveTooltip,
    positionTooltipNearNode,
    
    // Node highlighting
    setHighlightedNode,
    resetNodeHighlight,
    
    // Action handlers
    handleNetworkAction,
    handleExpandAction,
    handleProfileAction,
    handleCollaborationAction,
  };
}