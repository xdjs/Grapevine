import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from 'pg';

interface NetworkNode {
  id: string;
  name: string;
  type: string;
  types: string[];
  color: string;
  size: number;
  artistId: string | null;
  collaborations?: string[];
}

interface NetworkLink {
  source: string;
  target: string;
}

interface Collaborator {
  name: string;
  type: string;
  topCollaborators: string[];
}

interface CollaborationData {
  artists: Array<{
    name: string;
    type?: string;
    roles?: string[];
    topCollaborators: string[];
  }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log(`🔗 [Expand] Expansion request for artist ID ${req.query.artistId} - Full network mode`);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const artistId = req.query.artistId as string;
  if (!artistId) {
    return res.status(400).json({ message: 'Artist ID is required' });
  }

  try {
    const connectionString = process.env.CONNECTION_STRING;
    if (!connectionString) {
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    const client = new Client({ connectionString });
    await client.connect();

    // Get artist by ID
    const artistQuery = 'SELECT id, name FROM artists WHERE id = $1';
    const artistResult = await client.query(artistQuery, [artistId]);
    
    if (artistResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ message: 'Artist not found' });
    }

    const artist = artistResult.rows[0];
    console.log(`✅ [Expand] Found artist: "${artist.name}" (ID: ${artist.id})`);

    // Create main artist node
    const mainNode: NetworkNode = {
      id: artist.name,
      name: artist.name,
      type: 'artist',
      types: ['artist'],
      color: '#FF0ACF',
      size: 30,
      artistId: artist.id,
      collaborations: []
    };

    const nodeMap = new Map<string, NetworkNode>();
    const links: NetworkLink[] = [];
    const allPeople = new Set<string>();

    // Add main artist to node map
    nodeMap.set(artist.name, mainNode);
    allPeople.add(artist.name);

    // Import services
    let musicBrainzService, openaiService;
    
    try {
      const musicBrainzModule = await import('../../../server/musicbrainz.js');
      musicBrainzService = musicBrainzModule.musicBrainzService;
      console.log(`✅ [Expand] MusicBrainz service imported successfully`);
    } catch (importError) {
      console.error(`❌ [Expand] Failed to import MusicBrainz service:`, importError);
      console.log(`🔄 [Expand] Returning fallback response due to MusicBrainz import error`);
      return res.json({
        nodes: [
          { id: artist.name, name: artist.name, type: 'artist', types: ['artist'], color: '#FF0ACF', size: 30, artistId: artist.id }
        ],
        links: []
      });
    }

    try {
      const openaiModule = await import('../../../server/openai-service.js');
      openaiService = openaiModule.openaiService;
      console.log(`✅ [Expand] OpenAI service imported successfully`);
    } catch (importError) {
      console.error(`❌ [Expand] Failed to import OpenAI service:`, importError);
      // Continue without OpenAI service
    }

    // Get collaboration data from MusicBrainz
    console.log(`🔗 [Expand] Fetching collaborations for "${artist.name}" from MusicBrainz...`);
    let collaborationData;
    try {
      collaborationData = await musicBrainzService.getArtistCollaborations(artist.name);
      console.log(`✅ [Expand] MusicBrainz collaboration data received:`, collaborationData ? 'success' : 'null');
    } catch (musicBrainzError) {
      console.error(`❌ [Expand] MusicBrainz error:`, musicBrainzError);
      console.log(`🔄 [Expand] Returning fallback response due to MusicBrainz API error`);
      return res.json({
        nodes: [
          { id: artist.name, name: artist.name, type: 'artist', types: ['artist'], color: '#FF0ACF', size: 30, artistId: artist.id }
        ],
        links: []
      });
    }

    if (collaborationData && collaborationData.artists && collaborationData.artists.length > 0) {
      console.log(`✅ [Expand] Found ${collaborationData.artists.length} collaborators from MusicBrainz`);

      // Process all collaborators (no filtering in expansion mode)
      for (const collaborator of collaborationData.artists) {
        // Skip fake collaborators
        if (collaborator.name === artist.name || 
            collaborator.name.toLowerCase().includes('unknown') ||
            collaborator.name.toLowerCase().includes('various') ||
            collaborator.name.toLowerCase().includes('multiple')) {
          console.log(`🚫 [Expand] Filtering out fake collaborator: "${collaborator.name}"`);
          continue;
        }

        allPeople.add(collaborator.name);
        
        // Include ALL collaborators in expansion mode (no role filtering)
        const roles = collaborator.roles || [collaborator.type || 'artist'];
        const primaryRole = roles[0];
        
        console.log(`🎭 [Expand] Processing "${collaborator.name}" with roles: [${roles.join(', ')}]`);

        // Add branching artists for full network expansion
        for (const branchingArtist of collaborator.topCollaborators || []) {
          if (branchingArtist !== artist.name && 
              !branchingArtist.toLowerCase().includes('unknown') &&
              !branchingArtist.toLowerCase().includes('various') &&
              !branchingArtist.toLowerCase().includes('multiple')) {
            allPeople.add(branchingArtist);
          }
        }

        // Create node for this collaborator
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Update existing node
          for (const role of roles) {
            if (!collabNode.types.includes(role)) {
              collabNode.types.push(role);
              console.log(`🎭 [Expand] Added ${role} role to existing ${collaborator.name} node (now has ${collabNode.types.length} roles)`);
            }
          }
          if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
            const existingCollabs = collabNode.collaborations || [];
            const newCollabs = collaborator.topCollaborators.filter((c: string) => !existingCollabs.includes(c));
            collabNode.collaborations = [...existingCollabs, ...newCollabs];
          }
        } else {
          // Create new node
          collabNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: primaryRole,
            types: [...roles],
            color: primaryRole === 'producer' ? '#8A2BE2' : 
                   primaryRole === 'songwriter' ? '#00CED1' : 
                   primaryRole === 'artist' ? '#FF0ACF' : '#355367',
            size: 20,
            artistId: null,
            collaborations: collaborator.topCollaborators || []
          };

          // Look up MusicNerd ID for collaborator
          const collabQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
          const collabResult = await client.query(collabQuery, [collaborator.name]);
          if (collabResult.rows.length > 0) {
            collabNode.artistId = collabResult.rows[0].id;
          }

          nodeMap.set(collaborator.name, collabNode);
          console.log(`✅ [Expand] Created new node for "${collaborator.name}" with ${roles.length} roles: [${roles.join(', ')}]`);
        }

        // Create link to main artist
        const existingLink = links.find(link => 
          link.source === artist.name && link.target === collaborator.name
        );
        if (!existingLink) {
          links.push({
            source: artist.name,
            target: collaborator.name
          });
        }

        // Create branching artists (second-degree connections)
        if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
          console.log(`🔗 [Expand] Creating branching artists for ${collaborator.name}`);
          
          for (const branchingArtist of collaborator.topCollaborators) {
            if (branchingArtist !== artist.name && 
                !branchingArtist.toLowerCase().includes('unknown') &&
                !branchingArtist.toLowerCase().includes('various') &&
                !branchingArtist.toLowerCase().includes('multiple')) {
              
              // Check if we already have a node for this branching artist
              let branchingNode = nodeMap.get(branchingArtist);
              
              if (!branchingNode) {
                // Create new node for branching artist
                branchingNode = {
                  id: branchingArtist,
                  name: branchingArtist,
                  type: 'artist', // Default to artist for branching nodes
                  types: ['artist'],
                  color: '#FF0ACF',
                  size: 15, // Smaller size for second-degree nodes
                  artistId: null,
                  collaborations: []
                };
                
                // Look up MusicNerd ID for branching artist
                const branchingQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
                const branchingResult = await client.query(branchingQuery, [branchingArtist]);
                if (branchingResult.rows.length > 0) {
                  branchingNode.artistId = branchingResult.rows[0].id;
                }
                
                nodeMap.set(branchingArtist, branchingNode);
              }
              
              // Create link between collaborator and branching artist
              const existingBranchingLink = links.find(link => 
                (link.source === collaborator.name && link.target === branchingArtist) ||
                (link.source === branchingArtist && link.target === collaborator.name)
              );
              
              if (!existingBranchingLink) {
                links.push({
                  source: collaborator.name,
                  target: branchingArtist
                });
              }
            }
          }
        }
      }

      // Convert nodeMap to nodes array
      const nodes = Array.from(nodeMap.values());

      const networkData = { nodes, links };

      console.log(`✅ [Expand] Generated expansion network with ${nodes.length} nodes and ${links.length} links for artist ID ${artistId}`);
      console.log(`📊 [Expand] Nodes:`, nodes.map(n => `${n.name} (${n.type})`));
      console.log(`🔗 [Expand] Links:`, links.map(l => `${l.source} -> ${l.target}`));

      await client.end();
      res.json(networkData);
      
    } else {
      // No collaborations found
      console.log(`⚠️ [Expand] No collaborations found for "${artist.name}"`);
      const singleNodeData = { nodes: [mainNode], links: [] };
      await client.end();
      res.json(singleNodeData);
    }
    
  } catch (error) {
    console.error('❌ [Expand] Error generating expansion network:', error);
    console.error('❌ [Expand] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return a simple fallback response instead of error
    console.log(`🔄 [Expand] Returning fallback response for artist ID "${artistId}"`);
    const fallbackData = { 
      nodes: [
        { id: `artist-${artistId}`, name: `Artist ${artistId}`, type: 'artist', types: ['artist'], color: '#FF0ACF', size: 30, artistId: artistId }
      ], 
      links: [] 
    };
    
    try {
      await client.end();
    } catch (endError) {
      console.error('❌ [Expand] Error ending client connection:', endError);
    }
    
    res.json(fallbackData);
  }
} 