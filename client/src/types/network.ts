export interface NetworkNode {
  id: string;
  name: string;
  type: 'artist' | 'producer' | 'songwriter';
  types?: ('artist' | 'producer' | 'songwriter')[];
  size: number;
  collaborations?: string[];
  artistId?: string | null;
  imageUrl?: string | null;
  spotifyId?: string | null;
  musicNerdUrl?: string;
  xUsername?: string | null;
  instagramUsername?: string | null;
  facebookUsername?: string | null;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
  cached?: boolean;
}

export interface NoCollaboratorsResponse {
  noCollaborators: true;
  artistName: string;
  artistId: string;
  singleNodeNetwork: NetworkData;
}

export type NetworkResponse = NetworkData | NoCollaboratorsResponse;

export interface FilterState {
  showProducers: boolean;
  showSongwriters: boolean;
  showArtists: boolean;
}

export interface SearchHistoryEntry {
  artistName: string;
  artistId: string | null;
  timestamp: number;
  url: string;
}

export interface SearchHistory {
  entries: SearchHistoryEntry[];
}

export interface CollaborationProject {
  name: string;
  type: 'song' | 'album' | 'ep' | 'single';
  spotifyUrl?: string;
  year?: string;
}

export interface CollaborationDetails {
  description: string;
  projects: CollaborationProject[];
  personalHistory?: string;
}
