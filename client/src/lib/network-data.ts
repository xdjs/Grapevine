import { apiRequest } from "./queryClient";
import { NetworkData, NetworkResponse, NoCollaboratorsResponse } from "../types/network";
import { fetchAllArtistProfilePictures } from "./profile-pictures";

export async function fetchNetworkData(artistName: string, allowHallucinations?: boolean): Promise<NetworkResponse> {
  try {
    console.log(`🔍 [Frontend] Fetching network data for: "${artistName}"`);
    const url = allowHallucinations 
      ? `/api/network/${encodeURIComponent(artistName)}?allowHallucinations=true`
      : `/api/network/${encodeURIComponent(artistName)}`;
    console.log(`🔍 [Frontend] Request URL: ${url}`);
    
    const response = await apiRequest("GET", url);
    
    console.log(`🔍 [Frontend] Response status: ${response.status}`);
    console.log(`🔍 [Frontend] Response ok: ${response.ok}`);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        console.error(`❌ [Frontend] API error response:`, errorData);
      } catch (parseError) {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
        console.error(`❌ [Frontend] Non-JSON error response: ${errorText}`);
      }
      throw new Error(`Network request failed: ${errorMessage}`);
    }
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error(`❌ [Frontend] Failed to parse JSON response:`, parseError);
      const responseText = await response.text();
      console.error(`❌ [Frontend] Response text:`, responseText);
      throw new Error(`Cannot parse response data: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
    }
    
    console.log(`✅ [Frontend] Received network data with ${data.nodes?.length || 0} nodes`);
    
    // Always fetch profile pictures for all artist nodes, regardless of cache status
    // This ensures profile pictures are fresh and displayed consistently
    if (data && 'nodes' in data && data.nodes && data.nodes.length > 0) {
      const cacheStatus = data.cached ? 'cached' : 'fresh';
      console.log(`🖼️ [Frontend] Fetching profile pictures for all artist nodes (data source: ${cacheStatus})...`);
      try {
        const dataWithProfilePictures = await fetchAllArtistProfilePictures(data);
        console.log(`🖼️✅ [Frontend] Profile pictures fetched successfully for ${cacheStatus} data`);
        return dataWithProfilePictures;
      } catch (profileError) {
        console.warn(`🖼️⚠️ [Frontend] Failed to fetch profile pictures, continuing without them:`, profileError);
        return data; // Return original data if profile picture fetching fails
      }
    }
    
    return data;
  } catch (error) {
    console.error(`❌ [Frontend] Error fetching network data:`, error);
    throw error;
  }
}

export async function fetchNetworkDataById(artistId: string, allowHallucinations?: boolean): Promise<NetworkResponse> {
  try {
    console.log(`🔍 [Frontend] Fetching network data for artist ID: "${artistId}"`);
    const url = allowHallucinations 
      ? `/api/network-by-id/${encodeURIComponent(artistId)}?allowHallucinations=true`
      : `/api/network-by-id/${encodeURIComponent(artistId)}`;
    console.log(`🔍 [Frontend] Request URL: ${url}`);
    
    const response = await apiRequest("GET", url);
    
    console.log(`🔍 [Frontend] Response status: ${response.status}`);
    console.log(`🔍 [Frontend] Response ok: ${response.ok}`);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        console.error(`❌ [Frontend] API error response:`, errorData);
      } catch (parseError) {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
        console.error(`❌ [Frontend] Non-JSON error response: ${errorText}`);
      }
      throw new Error(`Network request failed: ${errorMessage}`);
    }
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error(`❌ [Frontend] Failed to parse JSON response:`, parseError);
      const responseText = await response.text();
      console.error(`❌ [Frontend] Response text:`, responseText);
      throw new Error(`Cannot parse response data: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
    }
    
    console.log(`✅ [Frontend] Received network data with ${data.nodes?.length || 0} nodes for artist ID: ${artistId}`);
    
    // Always fetch profile pictures for all artist nodes, regardless of cache status
    // This ensures profile pictures are fresh and displayed consistently
    if (data && 'nodes' in data && data.nodes && data.nodes.length > 0) {
      const cacheStatus = data.cached ? 'cached' : 'fresh';
      console.log(`🖼️ [Frontend] Fetching profile pictures for all artist nodes (data source: ${cacheStatus}, artist ID: ${artistId})...`);
      try {
        const dataWithProfilePictures = await fetchAllArtistProfilePictures(data);
        console.log(`🖼️✅ [Frontend] Profile pictures fetched successfully for ${cacheStatus} data (artist ID: ${artistId})`);
        return dataWithProfilePictures;
      } catch (profileError) {
        console.warn(`🖼️⚠️ [Frontend] Failed to fetch profile pictures, continuing without them:`, profileError);
        return data; // Return original data if profile picture fetching fails
      }
    }
    
    return data;
  } catch (error) {
    console.error(`❌ [Frontend] Error fetching network data:`, error);
    throw error;
  }
}

export async function searchArtist(query: string) {
  const response = await apiRequest("GET", `/api/search?q=${encodeURIComponent(query)}`);
  return response.json();
}
