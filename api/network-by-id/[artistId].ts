import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Fetches profile picture for an artist using Spotify and MusicBrainz fallbacks
 */
async function fetchProfilePicture(artistName: string): Promise<string | null> {
  console.log(`🖼️ [Profile] Fetching profile picture for: ${artistName}`);
  
  let profileImageUrl = null;
  
  // Method 1: Try Spotify API (if properly configured)
  try {
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
    
    // Check if we have real Spotify credentials (not placeholders)
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && 
        !SPOTIFY_CLIENT_ID.includes('placeholder') && 
        !SPOTIFY_CLIENT_ID.includes('your_') &&
        !SPOTIFY_CLIENT_SECRET.includes('placeholder') && 
        !SPOTIFY_CLIENT_SECRET.includes('your_')) {
      
      // Get access token
      const authString = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json() as { access_token: string };
        const accessToken = tokenData.access_token;
        
        // Search for artist
        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json() as { artists: { items: Array<{ images: Array<{ url: string }> }> } };
          const artists = searchData.artists.items;
          if (artists.length > 0 && artists[0].images && artists[0].images.length > 0) {
            // Use the smallest image for better performance (usually the last one)
            profileImageUrl = artists[0].images[artists[0].images.length - 1].url;
            console.log(`🖼️✅ [Profile] Found Spotify profile image for ${artistName}`);
          }
        }
      }
    } else {
      console.log(`🖼️⚠️ [Profile] Spotify credentials not properly configured`);
    }
  } catch (spotifyError) {
    console.warn(`🖼️❌ [Profile] Spotify API failed for ${artistName}:`, spotifyError instanceof Error ? spotifyError.message : 'Unknown error');
  }
  
  // Method 2: Fallback to MusicBrainz Cover Art Archive
  if (!profileImageUrl) {
    try {
      console.log(`🖼️🔄 [Profile] Trying MusicBrainz fallback for ${artistName}`);
      const mbResponse = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=artist:"${encodeURIComponent(artistName)}"&fmt=json&limit=1`
      );
      
      if (mbResponse.ok) {
        const mbData = await mbResponse.json() as { artists: Array<{ id: string }> };
        if (mbData.artists && mbData.artists.length > 0) {
          const artistId = mbData.artists[0].id;
          
          // Try to get Cover Art Archive image
          const caaResponse = await fetch(
            `https://coverartarchive.org/artist/${artistId}`,
            {
              headers: { 'User-Agent': 'Grapevine/1.0 (https://grapevine.app)' }
            }
          );
          
          if (caaResponse.ok) {
            const caaData = await caaResponse.json() as { images: Array<{ image: string, thumbnails: { small: string } }> };
            if (caaData.images && caaData.images.length > 0) {
              profileImageUrl = caaData.images[0].thumbnails?.small || caaData.images[0].image;
              console.log(`🖼️✅ [Profile] Found MusicBrainz profile image for ${artistName}`);
            }
          }
        }
      }
    } catch (mbError) {
      console.warn(`🖼️⚠️ [Profile] MusicBrainz fallback failed for ${artistName}:`, mbError instanceof Error ? mbError.message : 'Unknown error');
    }
  }
  
  if (profileImageUrl) {
    console.log(`🖼️✅ [Profile] Successfully fetched profile picture for ${artistName}`);
  } else {
    console.log(`🖼️⭕ [Profile] No profile image found for ${artistName}, using original design`);
  }
  
  return profileImageUrl;
}

interface NetworkNode {
  id: string;
  name: string;
  type: string;
  types: string[];
  color: string;
  size: number;
  artistId: string | null;
  collaborations?: string[];
  imageUrl?: string | null;
}

interface NetworkLink {
  source: string;
  target: string;
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

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { artistId } = req.query;
    
    if (!artistId || typeof artistId !== 'string') {
      return res.status(400).json({ message: 'Artist ID is required' });
    }

    console.log(`🔍 [Vercel] Network data request for artist ID: ${artistId}`);
    
    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found');
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    try {
      // Connect to database
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      
      // Get artist by ID
      const artistQuery = 'SELECT id, name, webmapdata FROM artists WHERE id = $1';
      const artistResult = await client.query(artistQuery, [artistId]);
      
      if (artistResult.rows.length === 0) {
        await client.end();
        return res.status(404).json({ 
          message: `Artist with ID "${artistId}" not found in database.`
        });
      }
      
      const artist = artistResult.rows[0];
      console.log(`✅ [Vercel] Found artist: "${artist.name}" (ID: ${artistId})`);
      
      // Check if we have cached network data
      if (artist.webmapdata) {
        console.log(`💾 [Vercel] Found cached webmapdata for artist ID "${artistId}" (${artist.name})`);
        
        // Check if this is a single-node network (no collaborators)
        const cachedData = artist.webmapdata;
        const isSingleNode = cachedData.nodes && cachedData.nodes.length === 1 && 
                            (!cachedData.links || cachedData.links.length === 0);
        
        if (isSingleNode) {
          // Always show popup for single-node networks, don't use cache for this case
          console.log(`🎭 [Vercel] Single-node network found, checking if user wants hallucinations`);
          const allowHallucinations = req.query.allowHallucinations === 'true';
          
          if (!allowHallucinations) {
            // Return special response to trigger popup
            await client.end();
            return res.json({
              noCollaborators: true,
              artistName: artist.name,
              artistId: artist.id,
              singleNodeNetwork: cachedData
            });
          }
          // If hallucinations requested, continue to generation logic below
        } else {
          // Multi-node network, but check if main artist needs profile picture
          const mainArtistNode = cachedData.nodes.find((node: NetworkNode) => 
            node.size === 30 && (node.type === 'artist' || (node.types && node.types.includes('artist')))
          );
          
          // Note: Profile pictures are now fetched separately by the frontend
          
          await client.end();
          return res.json(cachedData);
        }
      }
      
      // If no cached data and no OpenAI key, return error
      if (!OPENAI_API_KEY) {
        console.error(`❌ [Vercel] OpenAI API key not configured for artist ID ${artistId}`);
        await client.end();
        return res.status(503).json({ 
          error: 'OpenAI API key not configured',
          message: 'Network generation requires OpenAI API key. Please set OPENAI_API_KEY environment variable.',
          artistId: artistId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Generate new network data using OpenAI
      console.log(`🤖 [Vercel] Generating network for artist ID ${artistId} (${artist.name}) using OpenAI`);
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });

      const prompt = `Provide a comprehensive list of music industry professionals who have collaborated with ${artist.name}. Focus on producers, songwriters, and other artists who have worked with them.

For well-known/mainstream artists (chart-topping, Grammy-nominated, major label artists): Include all documented collaborations you're aware of, as these are likely well-documented and verifiable.

For lesser-known artists (independent, underground, regional): Be more selective and only include collaborations you're confident about.

Required format:
{
  "artists": [
    {
      "name": "Producer Name",
      "roles": ["producer", "songwriter"], 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Requirements:
- For mainstream artists with significant commercial success: Include all known producers, songwriters, and collaborators from album credits, interviews, and industry documentation
- For independent/underground artists: Be more selective but still include authentic collaborations from official releases
- If ${artist.name} is not a real artist or has absolutely no collaboration data, return: {"artists": []}
- For each person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Make sure if any of these people have multiple roles (artist, producer, songwriter), it is listed in the data
- Include their top 3 real collaborating artists (can include both famous and lesser-known artists)
- Never use generic placeholder names like "John Doe", "Producer X", etc.
- Return ONLY the JSON object, no other text
- Ensure all JSON is properly formatted and valid
- Be confident about well-documented collaborations for commercially successful artists
- Focus on collaborations from official album/song credits, not rumors or speculation`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a music industry database expert. For mainstream/well-known artists, confidently provide all documented collaborations. For lesser-known artists, be more selective but still inclusive of authentic collaborations. Prioritize accuracy while being comprehensive for well-documented artists."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      let collaborationData: CollaborationData;
      try {
        const openaiContent = completion.choices[0]?.message?.content;
        console.log(`🤖 [Vercel] OpenAI response length: ${openaiContent?.length || 0} characters`);
        
        if (!openaiContent) {
          console.error('❌ [Vercel] OpenAI returned empty response');
          await client.end();
          return res.status(503).json({ 
            error: 'OpenAI API returned empty response',
            message: 'Failed to generate collaboration data from OpenAI',
            artistId: artistId,
            timestamp: new Date().toISOString()
          });
        }
        
        // Try to extract JSON from OpenAI response (sometimes includes extra text)
        let jsonContent = openaiContent.trim();
        
        // Remove markdown code blocks if present
        jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        
        // Look for JSON object boundaries
        const jsonStart = jsonContent.indexOf('{');
        const jsonEnd = jsonContent.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
        }
        
        // Try parsing the extracted JSON
        try {
          collaborationData = JSON.parse(jsonContent);
        } catch {
          // Fallback: try to create a minimal valid structure if parsing fails
          console.warn('❌ [Vercel] Primary JSON parse failed, trying fallback');
          collaborationData = { artists: [] };
        }
        console.log(`✅ [Vercel] Parsed collaboration data with ${collaborationData.artists?.length || 0} artists`);
      } catch (parseError) {
        console.error('❌ [Vercel] Failed to parse OpenAI response:', parseError);
        console.error('❌ [Vercel] Raw OpenAI content:', completion.choices[0]?.message?.content);
        await client.end();
        return res.status(503).json({ 
          error: 'Failed to parse OpenAI response',
          message: 'OpenAI returned invalid JSON format',
          artistId: artistId,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          timestamp: new Date().toISOString()
        });
      }

      // Build network data structure with multi-role consolidation
      const nodeMap = new Map<string, NetworkNode>();
      const links: NetworkLink[] = [];

      // Detect roles for main artist first
      let mainArtistRoles = ['artist']; // Default fallback
      try {
        console.log(`🎭 [Vercel] Detecting roles for MAIN artist: "${artist.name}"`);
        
        const mainArtistRolePrompt = `What roles does ${artist.name} have in the music industry? CRITICAL: Search extensively for ALL POSSIBLE ROLES regardless of their popularity or fame level - many people have multiple roles (artist, producer, songwriter). This includes mainstream artists, independent artists, underground artists, regional artists, and emerging artists.

Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. 

Investigate thoroughly for multiple roles on ${artist.name}, whether they are famous or lesser-known. Return ONLY the JSON array, no other text.`;
        
        const mainRoleCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a music industry database expert. For mainstream/well-known artists, confidently provide all documented collaborations. For lesser-known artists, be more selective but still inclusive of authentic collaborations. Prioritize accuracy while being comprehensive for well-documented artists."
            },
            {
              role: "user",
              content: mainArtistRolePrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 100,
        });

        const mainRoleContent = mainRoleCompletion.choices[0]?.message?.content?.trim();
        if (mainRoleContent) {
          try {
            const detectedMainRoles = JSON.parse(mainRoleContent);
            if (Array.isArray(detectedMainRoles) && detectedMainRoles.length > 0) {
              mainArtistRoles = detectedMainRoles.filter(role => 
                ['artist', 'producer', 'songwriter'].includes(role)
              );
              console.log(`✅ [Vercel] Detected roles for MAIN artist "${artist.name}":`, mainArtistRoles);
            }
          } catch {
            console.log(`⚠️ [Vercel] Could not parse main artist role detection for "${artist.name}", using default`);
          }
        }
      } catch {
        console.log(`⚠️ [Vercel] Main artist role detection failed for "${artist.name}", using default`);
      }

      // Fetch profile picture for the main artist
      const mainArtistProfileImageUrl = await fetchProfilePicture(artist.name);

      // Add main artist node with detected roles and profile picture
      const mainNode = {
        id: artist.name,
        name: artist.name,
        type: mainArtistRoles[0],
        types: [...mainArtistRoles], // Include all roles
        color: '#FF69B4',
        size: 30,
        artistId: artist.id,
        imageUrl: mainArtistProfileImageUrl
      };
      nodeMap.set(artist.name, mainNode);
      console.log(`🎭 [Vercel] Created MAIN artist node "${artist.name}" with ${mainArtistRoles.length} roles: [${mainArtistRoles.join(', ')}]`);

      // Track whether hallucinations were used
      let hallucinationsUsed = false;

      // If no collaborators found, check if user wants hallucinated data
      if (!collaborationData.artists || collaborationData.artists.length === 0) {
        const allowHallucinations = req.query.allowHallucinations === 'true';
        
        if (!allowHallucinations) {
          console.log(`⚠️ [Vercel] No collaborators found for "${artist.name}", returning no-collaborators response`);
          const singleNodeData = { nodes: [mainNode], links: [] };
          
          await client.end();
          
          // Return special response indicating no collaborators found
          res.json({
            noCollaborators: true,
            artistName: artist.name,
            artistId: artist.id,
            singleNodeNetwork: singleNodeData
          });
          return;
        }
        
        // User requested hallucinated data - generate creative network
        console.log(`🎭 [Vercel] No real collaborators found for "${artist.name}", generating hallucinated network as requested`);
        hallucinationsUsed = true;
        
        const hallucinatedPrompt = `Create an imaginative collaboration network for ${artist.name}. Generate plausible but potentially fictional music industry collaborators who could work with this artist. Include both real and creative professionals.

Please respond with JSON in this exact format:
{
  "artists": [
    {
      "name": "Person Name",
      "type": "producer",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    },
    {
      "name": "Another Person",
      "type": "songwriter",
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Guidelines:
- Mix real industry professionals with plausible fictional ones
- Create 3-8 collaborators total
- Include producers, songwriters, and artists
- Use realistic but unique names (avoid common placeholder names like John Doe, Jane Smith, Producer X, etc.)
- Create names that sound like real music industry professionals
- Include varied collaboration styles that would fit ${artist.name}'s music
- Return ONLY the JSON object, no other text`;

        try {
          const hallucinatedCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: hallucinatedPrompt }],
            temperature: 0.7, // Higher temperature for creativity
            max_tokens: 2000,
          });

          const hallucinatedContent = hallucinatedCompletion.choices[0]?.message?.content;
          if (hallucinatedContent) {
            // Parse hallucinated content
            let jsonContent = hallucinatedContent.trim();
            jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
            
            const jsonStart = jsonContent.indexOf('{');
            const jsonEnd = jsonContent.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
            }
            
            try {
              const hallucinatedData = JSON.parse(jsonContent);
              if (hallucinatedData.artists && hallucinatedData.artists.length > 0) {
                // Use hallucinated data and continue with normal processing
                collaborationData = hallucinatedData;
                console.log(`✨ [Vercel] Generated ${hallucinatedData.artists.length} hallucinated collaborators for "${artist.name}"`);
              }
            } catch {
              console.warn('⚠️ [Vercel] Failed to parse hallucinated data, falling back to single node');
            }
          }
        } catch {
          console.warn('⚠️ [Vercel] Failed to generate hallucinated data, falling back to single node');
        }
        
        // If still no collaborators after hallucination attempt, return single node
        if (!collaborationData.artists || collaborationData.artists.length === 0) {
          const networkData = { nodes: [mainNode], links: [] };
          await client.end();
          res.json(networkData);
          return;
        }
      }

      // Function to detect fake collaborators
      const isFakeCollaborator = (name: string): boolean => {
        const lowerName = name.toLowerCase();
        const fakePatterns = [
          'john doe', 'jane doe', 'john smith', 'jane smith', 'joe smith', 'mary johnson',
          'bob johnson', 'sarah williams', 'mike brown', 'lisa davis', 'test user', 'test artist',
          'artist a', 'artist b', 'artist c', 'artist d', 'artist e',
          'producer a', 'producer b', 'producer c', 'producer d', 'producer e',
          'songwriter a', 'songwriter b', 'songwriter c', 'songwriter d', 'songwriter e',
          'artist 1', 'artist 2', 'artist 3', 'artist 4', 'artist 5',
          'producer 1', 'producer 2', 'producer 3', 'producer 4', 'producer 5',
          'songwriter 1', 'songwriter 2', 'songwriter 3', 'songwriter 4', 'songwriter 5',
          'unknown', 'anonymous', 'various', 'n/a', 'tbd', 'to be determined',
          'placeholder', 'example', 'sample', 'fictional', 'generic', 'default'
        ];
        return fakePatterns.some(pattern => lowerName.includes(pattern)) ||
               !!lowerName.match(/^(artist|producer|songwriter)\s+[a-z]$/i) ||
               !!lowerName.match(/^[a-z]{1,2}$/i);
      };

      // Process producers and songwriters with multi-role consolidation
      for (const collaborator of collaborationData.artists || []) {
        // Skip fake collaborators
        if (isFakeCollaborator(collaborator.name)) {
          console.log(`🚫 [Vercel] Filtering out fake collaborator: "${collaborator.name}"`);
          continue;
        }

        // Handle both new format (roles array) and old format (type field)
        const roles = collaborator.roles || [collaborator.type || 'producer'];
        console.log(`🎭 [Vercel] Processing "${collaborator.name}" with roles: [${roles.join(', ')}]`);
        
        // Check if we already have a node for this person
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Person already exists - merge all roles into their types array
          for (const role of roles) {
            if (!collabNode.types.includes(role)) {
              collabNode.types.push(role);
              console.log(`🎭 [Vercel] Added ${role} role to existing ${collaborator.name} node (now has ${collabNode.types.length} roles)`);
            }
          }
          // Update collaborations list
          if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
            const existingCollabs = collabNode.collaborations || [];
            const newCollabs = collaborator.topCollaborators.filter((c: string) => !existingCollabs.includes(c));
            collabNode.collaborations = [...existingCollabs, ...newCollabs];
          }
          // Update color for multi-role nodes (artist + songwriter = multi-color, producer + songwriter = purple)
          if (collabNode.types.includes('artist') && collabNode.types.includes('songwriter')) {
            collabNode.color = '#FF69B4'; // Keep artist color for artist-songwriters
          } else if (collabNode.types.includes('producer') && collabNode.types.includes('songwriter')) {
            collabNode.color = '#8A2BE2'; // Keep producer color for producer-songwriters
          }
        } else {
          // Create new node with all roles
          const primaryRole = roles[0];
          collabNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: primaryRole,
            types: [...roles], // Include all roles
            color: primaryRole === 'producer' ? '#8A2BE2' : '#00CED1',
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
          console.log(`✅ [Vercel] Created new node for "${collaborator.name}" with ${roles.length} roles: [${roles.join(', ')}]`);
        }

        // Create link (only once per person, not per role)
        const existingLink = links.find(link => link.source === artist.name && link.target === collaborator.name);
        if (!existingLink) {
          links.push({
            source: artist.name,
            target: collaborator.name
          });
        }

        // Add branching artists with comprehensive multi-role detection
        for (const branchingArtist of collaborator.topCollaborators || []) {
          if (branchingArtist !== artist.name && !nodeMap.has(branchingArtist) && !isFakeCollaborator(branchingArtist)) {
            
            // Use OpenAI to detect all roles for this artist node
            let branchingRoles = ['artist']; // Default fallback
            try {
              console.log(`🎭 [Vercel] Detecting roles for artist node: "${branchingArtist}"`);
              
              const rolePrompt = `What roles does ${branchingArtist} have in the music industry? CRITICAL: Search extensively for ALL POSSIBLE ROLES regardless of their popularity or fame level - many people have multiple roles (artist, producer, songwriter). This includes mainstream artists, independent artists, underground artists, regional artists, and emerging artists.

Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. 

Investigate thoroughly for multiple roles on ${branchingArtist}, whether they are famous or lesser-known. Return ONLY the JSON array, no other text.`;
              
              const roleCompletion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "system",
                    content: "You are a music industry database expert. For mainstream/well-known artists, confidently provide all documented collaborations. For lesser-known artists, be more selective but still inclusive of authentic collaborations. Prioritize accuracy while being comprehensive for well-documented artists."
                  },
                  {
                    role: "user",
                    content: rolePrompt
                  }
                ],
                temperature: 0.1,
                max_tokens: 100,
              });

              const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
              if (roleContent) {
                try {
                  const detectedRoles = JSON.parse(roleContent);
                  if (Array.isArray(detectedRoles) && detectedRoles.length > 0) {
                    branchingRoles = detectedRoles.filter(role => 
                      ['artist', 'producer', 'songwriter'].includes(role)
                    );
                    console.log(`✅ [Vercel] Detected roles for artist "${branchingArtist}":`, branchingRoles);
                  }
                } catch {
                  console.log(`⚠️ [Vercel] Could not parse role detection for "${branchingArtist}", using default`);
                }
              }
            } catch {
              console.log(`⚠️ [Vercel] Role detection failed for "${branchingArtist}", using default`);
            }

            const branchNode = {
              id: branchingArtist,
              name: branchingArtist,
              type: branchingRoles[0],
              types: branchingRoles,
              color: '#FF69B4',
              size: 15,
              artistId: null
            };

            // Look up MusicNerd ID for branching artist
            const branchQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
            const branchResult = await client.query(branchQuery, [branchingArtist]);
            if (branchResult.rows.length > 0) {
              branchNode.artistId = branchResult.rows[0].id;
            }

            nodeMap.set(branchingArtist, branchNode);
            console.log(`🎭 [Vercel] Created artist node "${branchingArtist}" with ${branchingRoles.length} roles: [${branchingRoles.join(', ')}]`);
            
            links.push({
              source: collaborator.name,
              target: branchingArtist
            });
          }
        }
      }

      // Convert nodeMap to nodes array
      const nodes = Array.from(nodeMap.values());

      const networkData = { nodes, links };

      // Only cache the generated data if hallucinations were NOT used
      if (!hallucinationsUsed) {
        try {
          const updateQuery = 'UPDATE artists SET webmapdata = $1 WHERE id = $2';
          await client.query(updateQuery, [JSON.stringify(networkData), artistId]);
          console.log(`💾 [Vercel] Cached network data for artist ID ${artistId} (${artist.name})`);
        } catch (cacheError) {
          console.warn('⚠️ [Vercel] Failed to cache data:', cacheError);
        }
      } else {
        console.log(`🎭 [Vercel] Skipping cache for artist ID ${artistId} (${artist.name}) due to hallucinated data`);
      }

      await client.end();
      console.log(`✅ [Vercel] Generated network with ${nodes.length} nodes for artist ID ${artistId}`);
      
      res.json(networkData);
      
    } catch (dbError) {
      console.error('❌ [Vercel] Database/OpenAI error:', dbError);
      console.error('❌ [Vercel] Error stack:', dbError instanceof Error ? dbError.stack : 'No stack trace');
      return res.status(500).json({ 
        message: 'Failed to generate network data', 
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error("❌ [Vercel] Error fetching network data by ID:", error);
    console.error('❌ [Vercel] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}