export interface NetworkNode {
  id: string;
  name: string;
  type: 'artist' | 'producer' | 'songwriter';
  size: number;
  collaborations?: string[];
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
}

export interface FilterState {
  showProducers: boolean;
  showSongwriters: boolean;
  showArtists: boolean;
}
