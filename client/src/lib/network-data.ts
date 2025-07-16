import { apiRequest } from "./queryClient";
import { NetworkData } from "../types/network";

export async function fetchNetworkData(artistName: string, refresh?: boolean): Promise<NetworkData> {
  try {
    console.log(`🔍 [Frontend] Fetching network data for: "${artistName}"${refresh ? ' (refreshing cache)' : ''}`);
    
    const url = `/api/network/${encodeURIComponent(artistName)}${refresh ? '?refresh=true' : ''}`;
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
    return data;
  } catch (error) {
    console.error(`❌ [Frontend] Error fetching network data:`, error);
    throw error;
  }
}

export async function fetchNetworkDataById(artistId: string, refresh?: boolean): Promise<NetworkData> {
  try {
    console.log(`🔍 [Frontend] Fetching network data for artist ID: "${artistId}"${refresh ? ' (refreshing cache)' : ''}`);
    
    const url = `/api/network-by-id/${encodeURIComponent(artistId)}${refresh ? '?refresh=true' : ''}`;
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

// Utility function to clear cache for an artist
export async function clearArtistCache(artistName: string): Promise<void> {
  try {
    console.log(`🗑️ [Frontend] Clearing cache for: "${artistName}"`);
    const response = await apiRequest("DELETE", `/api/clear-cache/${encodeURIComponent(artistName)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to clear cache: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`✅ [Frontend] Cache cleared:`, result.message);
  } catch (error) {
    console.error(`❌ [Frontend] Error clearing cache:`, error);
    throw error;
  }
}

// Utility function to clear cache for an artist by ID
export async function clearArtistCacheById(artistId: string): Promise<void> {
  try {
    console.log(`🗑️ [Frontend] Clearing cache for artist ID: "${artistId}"`);
    const response = await apiRequest("DELETE", `/api/clear-cache-by-id/${encodeURIComponent(artistId)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to clear cache: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`✅ [Frontend] Cache cleared:`, result.message);
  } catch (error) {
    console.error(`❌ [Frontend] Error clearing cache:`, error);
    throw error;
  }
}

// Utility function to refresh network data (clear cache + fetch fresh data)
export async function refreshNetworkData(artistName: string): Promise<NetworkData> {
  try {
    console.log(`🔄 [Frontend] Refreshing network data for: "${artistName}"`);
    
    // First clear the cache
    await clearArtistCache(artistName);
    
    // Then fetch fresh data
    return await fetchNetworkData(artistName, true);
  } catch (error) {
    console.error(`❌ [Frontend] Error refreshing network data:`, error);
    throw error;
  }
}
