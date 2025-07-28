import { NetworkData, NetworkNode } from '../types/network';

interface ProfilePictureResponse {
  artistName: string;
  imageUrl: string | null;
  success: boolean;
}

/**
 * Fetches profile picture for a single artist
 */
export async function fetchArtistProfilePicture(artistName: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/artist-profile-picture/${encodeURIComponent(artistName)}`);
    
    if (!response.ok) {
      console.warn(`Failed to fetch profile picture for ${artistName}: ${response.status}`);
      return null;
    }
    
    const data: ProfilePictureResponse = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error(`Error fetching profile picture for ${artistName}:`, error);
    return null;
  }
}

/**
 * Fetches profile pictures for the main artist(s) in a network
 * Only fetches for nodes with size >= 25 (main artists)
 */
export async function fetchMainArtistProfilePictures(networkData: NetworkData): Promise<NetworkData> {
  // Create a copy of the network data
  const updatedData: NetworkData = {
    nodes: [...networkData.nodes],
    links: [...networkData.links]
  };

  // Find main artist nodes (size >= 25 and type includes 'artist')
  const mainArtistNodes = updatedData.nodes.filter(node => 
    node.size >= 25 && 
    (node.type === 'artist' || (node.types && node.types.includes('artist')))
  );

  console.log(`🖼️ [Profile] Found ${mainArtistNodes.length} main artist nodes to fetch profile pictures for`);

  // Fetch profile pictures for all main artists in parallel
  const profilePicturePromises = mainArtistNodes.map(async (node) => {
    const imageUrl = await fetchArtistProfilePicture(node.name);
    if (imageUrl) {
      console.log(`🖼️✅ [Profile] Got profile picture for ${node.name}`);
      node.imageUrl = imageUrl;
    } else {
      console.log(`🖼️⭕ [Profile] No profile picture for ${node.name}, using original design`);
      node.imageUrl = null;
    }
    return node;
  });

  // Wait for all profile picture fetches to complete
  await Promise.allSettled(profilePicturePromises);

  return updatedData;
} 