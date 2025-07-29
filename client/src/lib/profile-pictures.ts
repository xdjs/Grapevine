import { NetworkData, NetworkNode } from '../types/network';

interface ProfilePictureResponse {
  artistName: string;
  imageUrl: string | null;
  success: boolean;
  debug?: {
    spotifyConfigured: boolean;
    spotifyAttempted: boolean;
    spotifySuccess: boolean;
    musicBrainzAttempted: boolean;
    musicBrainzSuccess: boolean;
    error: string | null;
  };
}

/**
 * Fetches profile picture for a single artist
 */
export async function fetchArtistProfilePicture(artistName: string): Promise<string | null> {
  try {
    console.log(`🖼️ [Frontend] Requesting profile picture for: ${artistName}`);
    
    // Add cache-busting parameter to ensure fresh requests
    const cacheBuster = Date.now();
    const response = await fetch(`/api/artist-profile-picture/${encodeURIComponent(artistName)}?cb=${cacheBuster}`);
    
    if (!response.ok) {
      console.warn(`🖼️ [Frontend] Profile picture request failed for ${artistName}: ${response.status}`);
      return null;
    }
    
    const data: ProfilePictureResponse = await response.json();
    
    // Log debug information
    if (data.debug) {
      console.log(`🖼️ [Frontend] Debug info for ${artistName}:`, {
        spotifyConfigured: data.debug.spotifyConfigured,
        spotifySuccess: data.debug.spotifySuccess,
        musicBrainzSuccess: data.debug.musicBrainzSuccess,
        error: data.debug.error
      });
      
      if (!data.debug.spotifyConfigured) {
        console.warn(`🖼️ [Frontend] ⚠️ Spotify credentials not configured for ${artistName} - profile pictures may not work`);
      }
    }
    
    if (data.imageUrl) {
      console.log(`🖼️ [Frontend] ✅ Profile picture found for ${artistName}: ${data.imageUrl.substring(0, 50)}...`);
    } else {
      console.log(`🖼️ [Frontend] ⭕ No profile picture found for ${artistName}`);
    }
    
    return data.imageUrl;
  } catch (error) {
    console.error(`🖼️ [Frontend] Error fetching profile picture for ${artistName}:`, error);
    return null;
  }
}

/**
 * Ensures all artist nodes in network data have profile pictures
 * Can be called multiple times safely - will only fetch missing profile pictures
 */
export async function ensureArtistProfilePictures(networkData: NetworkData): Promise<NetworkData> {
  if (!networkData || !networkData.nodes || networkData.nodes.length === 0) {
    return networkData;
  }

  const artistNodes = networkData.nodes.filter(node => 
    node.type === 'artist' || (node.types && node.types.includes('artist'))
  );

  const nodesNeedingPictures = artistNodes.filter(node => !node.imageUrl);
  
  if (nodesNeedingPictures.length === 0) {
    console.log(`🖼️ [Frontend] All ${artistNodes.length} artist nodes already have profile pictures`);
    return networkData;
  }

  console.log(`🖼️ [Frontend] ${nodesNeedingPictures.length}/${artistNodes.length} artist nodes need profile pictures`);
  
  // Fetch profile pictures for nodes that don't have them
  for (const node of nodesNeedingPictures) {
    try {
      const imageUrl = await fetchArtistProfilePicture(node.name);
      node.imageUrl = imageUrl;
    } catch (error) {
      console.error(`🖼️ [Frontend] Failed to fetch profile picture for ${node.name}:`, error);
      node.imageUrl = null;
    }
  }

  return networkData;
}

/**
 * Fetches profile pictures for all artist nodes in a network
 * Fetches for all nodes with type 'artist' or that include 'artist' in their types array
 * Always attempts to fetch fresh profile pictures to ensure consistent display
 */
export async function fetchAllArtistProfilePictures(networkData: NetworkData): Promise<NetworkData> {
  // Create a copy of the network data
  const updatedData: NetworkData = {
    nodes: [...networkData.nodes],
    links: [...networkData.links]
  };

  // Find all artist nodes (any node that is an artist, regardless of size)
  const artistNodes = updatedData.nodes.filter(node => 
    node.type === 'artist' || (node.types && node.types.includes('artist'))
  );

  if (artistNodes.length === 0) {
    console.log(`🖼️ [Frontend] No artist nodes found - skipping profile picture fetching`);
    return updatedData;
  }

  console.log(`🖼️ [Frontend] Found ${artistNodes.length} artist nodes to fetch profile pictures for:`, 
    artistNodes.map(n => `${n.name} (size: ${n.size})`));

  // Always clear existing profile pictures to ensure fresh fetching
  artistNodes.forEach(node => {
    node.imageUrl = null;
  });

  // Fetch profile pictures for all artists in parallel
  // Limit concurrent requests to avoid overwhelming the API
  const batchSize = 5; // Process 5 artists at a time
  const batches = [];
  
  for (let i = 0; i < artistNodes.length; i += batchSize) {
    batches.push(artistNodes.slice(i, i + batchSize));
  }

  console.log(`🖼️ [Frontend] Processing ${batches.length} batches of ${batchSize} artists each`);

  // Track overall progress
  let totalProcessed = 0;
  let totalSuccessful = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`🖼️ [Frontend] Processing batch ${batchIndex + 1}/${batches.length}:`, batch.map(n => n.name));
    
    const batchPromises = batch.map(async (node) => {
      try {
        const imageUrl = await fetchArtistProfilePicture(node.name);
        if (imageUrl) {
          console.log(`🖼️✅ [Frontend] Got profile picture for ${node.name} (size: ${node.size})`);
          node.imageUrl = imageUrl;
          return true; // Success
        } else {
          console.log(`🖼️⭕ [Frontend] No profile picture for ${node.name} (size: ${node.size}), using original design`);
          node.imageUrl = null;
          return false; // No picture found
        }
      } catch (error) {
        console.error(`🖼️❌ [Frontend] Error fetching profile picture for ${node.name}:`, error);
        node.imageUrl = null;
        return false; // Error occurred
      }
    });
    
    // Wait for this batch to complete before starting the next one
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Count successful results
    batchResults.forEach((result) => {
      totalProcessed++;
      if (result.status === 'fulfilled' && result.value === true) {
        totalSuccessful++;
      }
    });
    
    console.log(`🖼️ [Frontend] Batch ${batchIndex + 1} complete. Progress: ${totalProcessed}/${artistNodes.length} processed, ${totalSuccessful} successful`);
    
    // Small delay between batches to be nice to the API
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const withPictures = artistNodes.filter(n => n.imageUrl);
  const withoutPictures = artistNodes.filter(n => !n.imageUrl);

  console.log(`🖼️ [Frontend] Profile picture fetching complete. Final Summary:`, {
    totalArtists: artistNodes.length,
    withPictures: withPictures.length,
    withoutPictures: withoutPictures.length,
    successRate: `${Math.round((withPictures.length / artistNodes.length) * 100)}%`,
    artistsWithPictures: withPictures.map(n => n.name),
    artistsWithoutPictures: withoutPictures.map(n => n.name)
  });

  // Ensure the network visualizer will re-render with the new profile pictures
  console.log(`🖼️ [Frontend] Profile pictures ready for display. Artists with images: ${withPictures.length}/${artistNodes.length}`);

  return updatedData;

}

/**
 * @deprecated Use fetchAllArtistProfilePictures instead
 * Fetches profile pictures for the main artist(s) in a network
 * Only fetches for nodes with size >= 25 (main artists)
 */
export async function fetchMainArtistProfilePictures(networkData: NetworkData): Promise<NetworkData> {
  console.log(`🖼️ [Frontend] ⚠️ fetchMainArtistProfilePictures is deprecated, using fetchAllArtistProfilePictures instead`);
  return fetchAllArtistProfilePictures(networkData);
} 