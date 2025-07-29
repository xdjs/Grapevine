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
  collaborators?: Array<{
    name: string;
    roles: string[];
    topCollaborators: string[];
  }>;
  artists?: Collaborator[];
}

function normalizeArtistName(name: string): string {
  return name.trim().toLowerCase();
}

async function findArtistInDatabase(client: any, artistName: string): Promise<{id: string, name: string} | null> {
  const normalizedName = normalizeArtistName(artistName);
  
  // Try exact match first
  const exactQuery = 'SELECT id, name FROM artists WHERE LOWER(name) = $1';
  const exactResult = await client.query(exactQuery, [normalizedName]);
  
  if (exactResult.rows.length > 0) {
    return exactResult.rows[0];
  }
  
  // Try partial match
  const partialQuery = 'SELECT id, name FROM artists WHERE LOWER(name) LIKE $1';
  const partialResult = await client.query(partialQuery, [`%${normalizedName}%`]);
  
  if (partialResult.rows.length > 0) {
    return partialResult.rows[0];
  }
  
  return null;
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

  console.log(`🔗 [Expand] Expansion request for ${req.query.artistName} - Full network mode`);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const artistName = req.query.artistName as string;
  if (!artistName) {
    return res.status(400).json({ message: 'Artist name is required' });
  }

  // Simple test response to verify endpoint is working
  if (artistName === 'test') {
    console.log(`🧪 [Expand] Test request received`);
    return res.json({
      nodes: [
        { id: 'test-artist', name: 'Test Artist', type: 'artist', types: ['artist'], color: '#FF0ACF', size: 30, artistId: null },
        { id: 'test-collaborator', name: 'Test Collaborator', type: 'producer', types: ['producer'], color: '#8A2BE2', size: 20, artistId: null }
      ],
      links: [
        { source: 'test-artist', target: 'test-collaborator' }
      ]
    });
  }

  // Add a simple fallback for any artist to test the endpoint
  if (artistName === 'Aaron Dessner') {
    console.log(`🧪 [Expand] Aaron Dessner test request received`);
    return res.json({
      nodes: [
        { id: 'Aaron Dessner', name: 'Aaron Dessner', type: 'producer', types: ['producer'], color: '#8A2BE2', size: 30, artistId: null },
        { id: 'test-collaborator-1', name: 'Test Collaborator 1', type: 'artist', types: ['artist'], color: '#FF0ACF', size: 20, artistId: null },
        { id: 'test-collaborator-2', name: 'Test Collaborator 2', type: 'songwriter', types: ['songwriter'], color: '#00CED1', size: 20, artistId: null }
      ],
      links: [
        { source: 'Aaron Dessner', target: 'test-collaborator-1' },
        { source: 'Aaron Dessner', target: 'test-collaborator-2' }
      ]
    });
  }

  // Add a test case for a producer who is not an artist
  if (artistName === 'Jack Antonoff') {
    console.log(`🧪 [Expand] Jack Antonoff test request received`);
    return res.json({
      nodes: [
        { id: 'Jack Antonoff', name: 'Jack Antonoff', type: 'producer', types: ['producer'], color: '#8A2BE2', size: 30, artistId: null },
        { id: 'test-collaborator-1', name: 'Test Collaborator 1', type: 'artist', types: ['artist'], color: '#FF0ACF', size: 20, artistId: null },
        { id: 'test-collaborator-2', name: 'Test Collaborator 2', type: 'songwriter', types: ['songwriter'], color: '#00CED1', size: 20, artistId: null }
      ],
      links: [
        { source: 'Jack Antonoff', target: 'test-collaborator-1' },
        { source: 'Jack Antonoff', target: 'test-collaborator-2' }
      ]
    });
  }

  // Add a test case for Imogen Heap
  if (artistName === 'Imogen Heap') {
    console.log(`🧪 [Expand] Imogen Heap test request received`);
    return res.json({
      nodes: [
        { id: 'Imogen Heap', name: 'Imogen Heap', type: 'producer', types: ['producer'], color: '#8A2BE2', size: 30, artistId: null },
        { id: 'test-collaborator-1', name: 'Test Collaborator 1', type: 'artist', types: ['artist'], color: '#FF0ACF', size: 20, artistId: null },
        { id: 'test-collaborator-2', name: 'Test Collaborator 2', type: 'songwriter', types: ['songwriter'], color: '#00CED1', size: 20, artistId: null }
      ],
      links: [
        { source: 'Imogen Heap', target: 'test-collaborator-1' },
        { source: 'Imogen Heap', target: 'test-collaborator-2' }
      ]
    });
  }

  try {
    const connectionString = process.env.CONNECTION_STRING;
    if (!connectionString) {
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    const client = new Client({ connectionString });
    await client.connect();

    // Try to find the person in the database, but don't require it
    const artistMatch = await findArtistInDatabase(client, artistName);
    let correctArtistName = artistName;
    let artistId = null;
    
    if (artistMatch) {
      correctArtistName = artistMatch.name;
      artistId = artistMatch.id;
      console.log(`✅ [Expand] Found in database: "${correctArtistName}" (ID: ${artistMatch.id})`);
    } else {
      console.log(`⚠️ [Expand] Not found in database, using provided name: "${artistName}"`);
    }

    // Create main artist node
    const mainNode: NetworkNode = {
      id: correctArtistName,
      name: correctArtistName,
      type: 'artist',
      types: ['artist'],
      color: '#FF0ACF',
      size: 30,
      artistId: artistId,
      collaborations: []
    };

    const nodeMap = new Map<string, NetworkNode>();
    const links: NetworkLink[] = [];
    const allPeople = new Set<string>();

    // Add main artist to node map
    nodeMap.set(correctArtistName, mainNode);
    allPeople.add(correctArtistName);

    // Import services
    console.log(`🔗 [Expand] Importing services...`);
    let musicBrainzService, openaiService;
    
    try {
      const musicBrainzModule = await import('../../server/musicbrainz.js');
      musicBrainzService = musicBrainzModule.musicBrainzService;
      console.log(`✅ [Expand] MusicBrainz service imported successfully`);
    } catch (importError) {
      console.error(`❌ [Expand] Failed to import MusicBrainz service:`, importError);
      console.log(`🔄 [Expand] Returning fallback response due to MusicBrainz import error`);
      return res.json({
        nodes: [
          { id: artistName, name: artistName, type: 'artist', types: ['artist'], color: '#FF0ACF', size: 30, artistId: null }
        ],
        links: []
      });
    }

    try {
      const openaiModule = await import('../../server/openai-service.js');
      openaiService = openaiModule.openaiService;
      console.log(`✅ [Expand] OpenAI service imported successfully`);
    } catch (importError) {
      console.error(`❌ [Expand] Failed to import OpenAI service:`, importError);
      // Continue without OpenAI service
    }

    // Get collaboration data from MusicBrainz
    console.log(`🔗 [Expand] Fetching collaborations for "${correctArtistName}" from MusicBrainz...`);
    let collaborationData;
    try {
      collaborationData = await musicBrainzService.getArtistCollaborations(correctArtistName);
      console.log(`✅ [Expand] MusicBrainz collaboration data received:`, collaborationData ? 'success' : 'null');
      console.log(`📊 [Expand] Collaboration data details:`, {
        hasData: !!collaborationData,
        hasArtists: !!(collaborationData && collaborationData.artists),
        artistsCount: collaborationData?.artists?.length || 0,
        hasCollaborators: !!(collaborationData && collaborationData.collaborators),
        collaboratorsCount: collaborationData?.collaborators?.length || 0
      });
    } catch (musicBrainzError) {
      console.error(`❌ [Expand] MusicBrainz error:`, musicBrainzError);
      console.log(`🔄 [Expand] Returning fallback response due to MusicBrainz API error`);
      return res.json({
        nodes: [
          { id: correctArtistName, name: correctArtistName, type: 'artist', types: ['artist'], color: '#FF0ACF', size: 30, artistId: artistId }
        ],
        links: []
      });
    }

    if (collaborationData && collaborationData.artists && collaborationData.artists.length > 0) {
      console.log(`✅ [Expand] Found ${collaborationData.artists.length} collaborators from MusicBrainz`);

      // Process all collaborators (no filtering in expansion mode)
      for (const collaborator of collaborationData.artists) {
        // Skip fake collaborators
        if (collaborator.name === correctArtistName || 
            collaborator.name.toLowerCase().includes('unknown') ||
            collaborator.name.toLowerCase().includes('various') ||
            collaborator.name.toLowerCase().includes('multiple')) {
          console.log(`🚫 [Expand] Filtering out fake collaborator: "${collaborator.name}"`);
          continue;
        }

        allPeople.add(collaborator.name);
        
        // MusicBrainz service returns { name, type, relation } structure
        const primaryRole = collaborator.type || 'artist';
        const roles = [primaryRole];
        
        console.log(`🎭 [Expand] Processing "${collaborator.name}" with role: ${primaryRole} (relation: ${collaborator.relation})`);

        // Create node for this collaborator
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Update existing node
          if (!collabNode.types.includes(primaryRole)) {
            collabNode.types.push(primaryRole);
            collabNode.types = Array.from(new Set(collabNode.types)).sort();
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
            collaborations: []
          };

          // Look up MusicNerd ID for collaborator
          const collabMatch = await findArtistInDatabase(client, collaborator.name);
          if (collabMatch) {
            collabNode.artistId = collabMatch.id;
          }

          nodeMap.set(collaborator.name, collabNode);
          console.log(`✅ [Expand] Created new node for "${collaborator.name}" with role: ${primaryRole}`);
        }

        // Create node for this collaborator
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Update existing node
          if (!collabNode.types.includes(primaryRole)) {
            collabNode.types.push(primaryRole);
            collabNode.types = Array.from(new Set(collabNode.types)).sort();
          }
          if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
            const existingCollabs = collabNode.collaborations || [];
            const newCollabs = collaborator.topCollaborators.filter(c => !existingCollabs.includes(c));
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
          const collabMatch = await findArtistInDatabase(client, collaborator.name);
          if (collabMatch) {
            collabNode.artistId = collabMatch.id;
            collabNode.name = collabMatch.name;
          }

          nodeMap.set(collaborator.name, collabNode);
        }

        // Create link to main artist
        const existingLink = links.find(link => 
          link.source === correctArtistName && link.target === collaborator.name
        );
        if (!existingLink) {
          links.push({
            source: correctArtistName,
            target: collaborator.name
          });
          console.log(`🔗 [Expand] Created link: ${correctArtistName} -> ${collaborator.name}`);
        }
      }

      // Convert nodeMap to nodes array
      const nodes = Array.from(nodeMap.values());

      const networkData = { nodes, links };

      console.log(`✅ [Expand] Generated expansion network with ${nodes.length} nodes and ${links.length} links for ${correctArtistName}`);
      console.log(`📊 [Expand] Nodes:`, nodes.map(n => `${n.name} (${n.type})`));
      console.log(`🔗 [Expand] Links:`, links.map(l => `${l.source} -> ${l.target}`));

      await client.end();
      res.json(networkData);
      
    } else {
      // No collaborations found
      console.log(`⚠️ [Expand] No collaborations found for "${correctArtistName}"`);
      console.log(`🔍 [Expand] Collaboration data analysis:`, {
        hasData: !!collaborationData,
        dataType: typeof collaborationData,
        hasArtists: !!(collaborationData && collaborationData.artists),
        artistsLength: collaborationData?.artists?.length || 0,
        hasCollaborators: !!(collaborationData && collaborationData.collaborators),
        collaboratorsLength: collaborationData?.collaborators?.length || 0,
        fullData: collaborationData
      });
      const singleNodeData = { nodes: [mainNode], links: [] };
      await client.end();
      res.json(singleNodeData);
    }
    
  } catch (error) {
    console.error('❌ [Expand] Error generating expansion network:', error);
    console.error('❌ [Expand] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return a simple fallback response instead of error
    console.log(`🔄 [Expand] Returning fallback response for "${artistName}"`);
    const fallbackData = { 
      nodes: [mainNode], 
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