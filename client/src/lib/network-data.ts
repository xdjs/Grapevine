import { apiRequest } from "./queryClient";
import { NetworkData, NetworkResponse, NoCollaboratorsResponse } from "../types/network";

export async function fetchNetworkSkeletonById(artistId: string, allowHallucinations?: boolean): Promise<NetworkResponse> {
  try {
    console.log(`🔍 [Frontend] Fetching SKELETON network for artist ID: "${artistId}"`);
    const url = `/api/network-skeleton-by-id/${encodeURIComponent(artistId)}${allowHallucinations ? '?allowHallucinations=true' : ''}`;
    const response = await apiRequest("GET", url);
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {}
      throw new Error(`Network request failed: ${errorMessage}`);
    }
    const data = await response.json();
    console.log(`✅ [Frontend] Received skeleton network (by ID) with ${data.nodes?.length || 0} nodes`);
    return data;
  } catch (error) {
    console.error(`❌ [Frontend] Error fetching skeleton network by ID:`, error);
    throw error;
  }
}

export async function fetchNetworkData(artistName: string, allowHallucinations?: boolean): Promise<NetworkResponse> {
  try {
    console.log(`🔍 [Frontend] Fetching network data for: "${artistName}"`);
    // Prefer skeleton endpoint to avoid server timeouts
    const url = `/api/network-skeleton/${encodeURIComponent(artistName)}${allowHallucinations ? '?allowHallucinations=true' : ''}`;
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

export async function fetchNetworkDataById(artistId: string, allowHallucinations?: boolean): Promise<NetworkResponse> {
  try {
    console.log(`🔍 [Frontend] Fetching network data for artist ID: "${artistId}"`);
    // Prefer skeleton by resolving name on server via ID in the future; for now, call legacy but fall back to skeleton on 500/timeout
    const url = `/api/network-by-id/${encodeURIComponent(artistId)}${allowHallucinations ? '?allowHallucinations=true' : ''}`;
    console.log(`🔍 [Frontend] Request URL: ${url}`);
    
    let response = await apiRequest("GET", url);
    if (!response.ok && response.status >= 500) {
      console.warn('⚠️ Falling back to skeleton endpoint due to server error');
      // Attempt to fetch artist options to get name, else fail over gracefully
      try {
        const optionsResp = await apiRequest('GET', `/api/artist-options/${encodeURIComponent(artistId)}`);
        const options = await optionsResp.json();
        const name = options?.options?.[0]?.name;
        if (name) {
          return await fetchNetworkData(name, allowHallucinations);
        }
      } catch {}
    }
    
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
