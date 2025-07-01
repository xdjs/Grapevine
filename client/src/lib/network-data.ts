import { apiRequest } from "./queryClient";
import { NetworkData } from "../types/network";

export async function fetchNetworkData(artistName: string): Promise<NetworkData> {
  try {
    console.log(`🔍 [Frontend] Fetching network data for: "${artistName}"`);
    console.log(`🔍 [Frontend] Request URL: /api/network/${encodeURIComponent(artistName)}`);
    
    const response = await apiRequest("GET", `/api/network/${encodeURIComponent(artistName)}`);
    
    console.log(`🔍 [Frontend] Response status: ${response.status}`);
    console.log(`🔍 [Frontend] Response ok: ${response.ok}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Frontend] API error: ${response.status} - ${errorText}`);
      throw new Error(`Network request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`✅ [Frontend] Received network data with ${data.nodes?.length || 0} nodes`);
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
