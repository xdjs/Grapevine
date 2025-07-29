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
    const response = await fetch(`/api/artist-profile-picture/${encodeURIComponent(artistName)}`);
    
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
 * Fetches profile pictures for all artist nodes in a network
 * Fetches for all nodes with type 'artist' or that include 'artist' in their types array
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

  console.log(`🖼️ [Frontend] Found ${artistNodes.length} artist nodes to fetch profile pictures for:`, 
    artistNodes.map(n => `${n.name} (size: ${n.size})`));

  // Fetch profile pictures for all artists in parallel
  // Limit concurrent requests to avoid overwhelming the API
  const batchSize = 5; // Process 5 artists at a time
  const batches = [];
  
  for (let i = 0; i < artistNodes.length; i += batchSize) {
    batches.push(artistNodes.slice(i, i + batchSize));
  }

  console.log(`🖼️ [Frontend] Processing ${batches.length} batches of ${batchSize} artists each`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`🖼️ [Frontend] Processing batch ${batchIndex + 1}/${batches.length}:`, batch.map(n => n.name));
    
    const batchPromises = batch.map(async (node) => {
      const imageUrl = await fetchArtistProfilePicture(node.name);
      if (imageUrl) {
        console.log(`🖼️✅ [Frontend] Got profile picture for ${node.name} (size: ${node.size})`);
        node.imageUrl = imageUrl;
      } else {
        console.log(`🖼️⭕ [Frontend] No profile picture for ${node.name} (size: ${node.size}), using original design`);
        node.imageUrl = null;
      }
      return node;
    });
    
    // Wait for this batch to complete before starting the next one
    await Promise.allSettled(batchPromises);
    
    // Small delay between batches to be nice to the API
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const withPictures = artistNodes.filter(n => n.imageUrl);
  const withoutPictures = artistNodes.filter(n => !n.imageUrl);

  console.log(`🖼️ [Frontend] Profile picture fetching complete. Summary:`, {
    totalArtists: artistNodes.length,
    withPictures: withPictures.length,
    withoutPictures: withoutPictures.length,
    successRate: `${Math.round((withPictures.length / artistNodes.length) * 100)}%`,
    artistsWithPictures: withPictures.map(n => n.name),
    artistsWithoutPictures: withoutPictures.map(n => n.name)
  });

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