import { apiRequest } from "./queryClient";
import { NetworkData } from "../types/network";

export async function fetchNetworkData(artistName: string): Promise<NetworkData> {
  const response = await apiRequest("GET", `/api/network/${encodeURIComponent(artistName)}`);
  return response.json();
}

export async function searchArtist(query: string) {
  const response = await apiRequest("GET", `/api/search?q=${encodeURIComponent(query)}`);
  return response.json();
}
