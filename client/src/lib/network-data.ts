import { apiRequest } from "./queryClient";
import { NetworkData, NetworkResponse, NoCollaboratorsResponse } from "../types/network";

export async function fetchNetworkData(artistName: string, allowHallucinations?: boolean): Promise<NetworkResponse> {
  try {
    // Initialize global timing steps if not present
    const stepsArr: Array<{ step: string; ts: string; deltaMs: number }> = (typeof window !== 'undefined' && (window as any).__GV_TIMING_STEPS) || [];
    const pushStep = (label: string, tsIso?: string) => {
      const ts = tsIso || new Date().toISOString();
      const prev = stepsArr.length > 0 ? stepsArr[stepsArr.length - 1].ts : undefined;
      const delta = prev ? (new Date(ts).getTime() - new Date(prev).getTime()) : 0;
      const entry = { step: label, ts, deltaMs: delta };
      stepsArr.push(entry);
      if (typeof window !== 'undefined') (window as any).__GV_TIMING_STEPS = stepsArr;
      console.table?.([entry]);
    };
    // Ensure Search initiated is first if not already set by caller
    if (!(typeof window !== 'undefined' && (window as any).__GV_TIMING_STEPS?.length)) {
      pushStep('Search initiated');
    }
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
    
    // Extract server timings if present
    const serverTimings = (data && data._timings) ? data._timings : null;
    if (serverTimings?.cacheCheckEnd) pushStep('Cache check complete', serverTimings.cacheCheckEnd);
    if (serverTimings?.openAIRequestEnd) pushStep('OpenAI request complete', serverTimings.openAIRequestEnd);
    console.log('[Grapevine Timings] Server steps JSON:', JSON.stringify({ steps: stepsArr }, null, 2));
    console.log(`✅ [Frontend] Received network data with ${data.nodes?.length || 0} nodes`);
    return data;
  } catch (error) {
    console.error(`❌ [Frontend] Error fetching network data:`, error);
    throw error;
  }
}

export async function fetchNetworkDataById(artistId: string, allowHallucinations?: boolean): Promise<NetworkResponse> {
  try {
    const stepsArr: Array<{ step: string; ts: string; deltaMs: number }> = (typeof window !== 'undefined' && (window as any).__GV_TIMING_STEPS) || [];
    const pushStep = (label: string, tsIso?: string) => {
      const ts = tsIso || new Date().toISOString();
      const prev = stepsArr.length > 0 ? stepsArr[stepsArr.length - 1].ts : undefined;
      const delta = prev ? (new Date(ts).getTime() - new Date(prev).getTime()) : 0;
      const entry = { step: label, ts, deltaMs: delta };
      stepsArr.push(entry);
      if (typeof window !== 'undefined') (window as any).__GV_TIMING_STEPS = stepsArr;
      console.table?.([entry]);
    };
    if (!(typeof window !== 'undefined' && (window as any).__GV_TIMING_STEPS?.length)) {
      pushStep('Search initiated');
    }
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
    
    const serverTimings = (data && data._timings) ? data._timings : null;
    if (serverTimings?.cacheCheckEnd) pushStep('Cache check complete', serverTimings.cacheCheckEnd);
    if (serverTimings?.openAIRequestEnd) pushStep('OpenAI request complete', serverTimings.openAIRequestEnd);
    console.log('[Grapevine Timings] Server steps JSON:', JSON.stringify({ steps: stepsArr }, null, 2));
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
