import { apiRequest } from "./queryClient";
import { NetworkData, NetworkResponse, NoCollaboratorsResponse } from "../types/network";

export async function fetchSkeletonByName(artistName: string): Promise<NetworkData> {
  const url = `/api/network-skeleton/${encodeURIComponent(artistName)}`;
  const response = await apiRequest("GET", url);
  if (!response.ok) throw new Error(`Skeleton request failed: HTTP ${response.status}`);
  return response.json();
}

export async function fetchSkeletonById(artistId: string): Promise<NetworkData> {
  const url = `/api/network-skeleton-by-id/${encodeURIComponent(artistId)}`;
  const response = await apiRequest("GET", url);
  if (!response.ok) throw new Error(`Skeleton by id failed: HTTP ${response.status}`);
  return response.json();
}

export async function fetchRoles(names: string[]): Promise<Record<string, string[]>> {
  if (names.length === 0) return {};
  const resp = await fetch('/api/network-roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names })
  });
  if (!resp.ok) return {};
  const data = await resp.json();
  return data?.roles ?? {};
}

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
