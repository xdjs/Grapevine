import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// Spotify service for fetching artist images
class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer

      if (!this.accessToken) {
        throw new Error('Access token is null after successful API response');
      }
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Spotify access token:', error);
      throw new Error('Spotify API authentication failed');
    }
  }

  async searchArtist(artistName: string): Promise<any | null> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        'https://api.spotify.com/v1/search',
        {
          params: {
            q: artistName,
            type: 'artist',
            limit: 1
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const artists = response.data.artists.items;
      return artists.length > 0 ? artists[0] : null;
    } catch (error) {
      console.error(`Failed to search for artist ${artistName}:`, error);
      return null;
    }
  }

  getArtistImageUrl(artist: any, size: 'small' | 'medium' | 'large' = 'medium'): string | null {
    if (!artist.images || artist.images.length === 0) {
      return null;
    }

    // Sort images by size (largest first)
    const sortedImages = artist.images.sort((a: any, b: any) => b.width - a.width);

    switch (size) {
      case 'small':
        return sortedImages[sortedImages.length - 1]?.url || sortedImages[0]?.url;
      case 'large':
        return sortedImages[0]?.url;
      case 'medium':
      default:
        return sortedImages[Math.floor(sortedImages.length / 2)]?.url || sortedImages[0]?.url;
    }
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

const spotifyService = new SpotifyService();

interface NetworkNode {
  id: string;
  name: string;
  type: string;
  types: string[];
  color: string;
  size: number;
  artistId: string | null;
  imageUrl?: string | null;
  spotifyId?: string | null;
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

// Add artist name normalization function
function normalizeArtistName(name: string): string {
  // Remove parenthetical information like "(French Kiwi Juice)"
  let normalized = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  
  // Remove common suffixes that might cause mismatches
  normalized = normalized.replace(/\s+(aka|also known as|formerly)\s+.*$/i, '').trim();
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Add enhanced artist lookup function
async function findArtistInDatabase(client: any, artistName: string): Promise<{id: string, name: string} | null> {
  const variations = [
    artistName, // Original name
    normalizeArtistName(artistName), // Normalized name
  ];
  
  // Remove duplicates
  const uniqueVariations = [...new Set(variations)];
  
  for (const variation of uniqueVariations) {
    if (!variation || variation.length < 2) continue;
    
    console.log(`🔍 [Vercel] Trying artist lookup with variation: "${variation}"`);
    
    const query = 'SELECT id, name FROM artists WHERE LOWER(name) = LOWER($1)';
    const result = await client.query(query, [variation]);
    
    if (result.rows.length > 0) {
      console.log(`✅ [Vercel] Found match for "${artistName}" using variation "${variation}": "${result.rows[0].name}" (${result.rows[0].id})`);
      return {
        id: result.rows[0].id.toString(),
        name: result.rows[0].name
      };
    }
  }
  
  console.log(`📭 [Vercel] No database match found for "${artistName}" with any variation`);
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

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { artistName } = req.query;
    
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    console.log(`🎵 [Vercel] Network data request for: ${artistName}`);
    console.log(`🎵 [Vercel] Function started at:`, new Date().toISOString());
    console.log(`🎵 [Vercel] Environment check - CONNECTION_STRING exists:`, !!process.env.CONNECTION_STRING);
    console.log(`🎵 [Vercel] Environment check - OPENAI_API_KEY exists:`, !!process.env.OPENAI_API_KEY);
    console.log(`🎵 [Vercel] Node.js version:`, process.version);
    console.log(`🎵 [Vercel] Request headers:`, JSON.stringify(req.headers, null, 2));
    
    // Get environment variables
    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!CONNECTION_STRING) {
      console.error('❌ [Vercel] CONNECTION_STRING not found');
      console.error('❌ [Vercel] Available env vars:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    try {
      // First, check if we have cached data
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      
      // First check if artist exists in database and get the correct capitalization
      const artistMatch = await findArtistInDatabase(client, artistName);
      
      if (!artistMatch) {
        await client.end();
        return res.status(404).json({ 
          message: `Artist "${artistName}" not found in database. Please search for an existing artist.`
        });
      }
      
      // Use the correct artist name from database (with proper capitalization)
      const correctArtistName = artistMatch.name;
      
      // Skip cache and force fresh generation for all artists with data-only approach
      console.log(`🔄 [Vercel] Skipping cache and forcing fresh generation for ${artistName} with data-only approach`);
      
      // If no cached data and no OpenAI key, return error
      if (!OPENAI_API_KEY) {
        console.error(`❌ [Vercel] OpenAI API key not configured for ${artistName}`);
        await client.end();
        return res.status(503).json({ 
          error: 'OpenAI API key not configured',
          message: 'Network generation requires OpenAI API key. Please set OPENAI_API_KEY environment variable.',
          artist: artistName,
          timestamp: new Date().toISOString()
        });
      }
      
      // Generate new network data using OpenAI
      console.log(`🤖 [Vercel] Generating network for ${artistName} using OpenAI`);
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });

      const prompt = `Provide a comprehensive list of music industry professionals who have collaborated with ${correctArtistName}. Focus on producers, songwriters, and other artists who have worked with them.

For well-known/mainstream artists (chart-topping, Grammy-nominated, major label artists): Include all documented collaborations you're aware of, as these are likely well-documented and verifiable.

For lesser-known artists (independent, underground, regional): Be more selective and only include collaborations you're confident about.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "roles": ["producer", "songwriter"], 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Guidelines:
- For mainstream artists with significant commercial success: Include all known producers, songwriters, and collaborators from album credits, interviews, and industry documentation
- For independent/underground artists: Be more selective but still include authentic collaborations from official releases
- If ${correctArtistName} is not a real artist or has absolutely no collaboration data, return: {"collaborators": []}
- For each person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Make sure if any of these people have multiple roles (artist, producer, songwriter), it is listed in the data
- Include their top 3 real collaborating artists (can include both famous and lesser-known artists)
- Never use generic placeholder names like "John Doe", "Producer X", etc.
- Maximum 10 real collaborators if they exist
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
            artist: artistName,
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
        console.log(`✅ [Vercel] Parsed collaboration data with ${collaborationData.collaborators?.length || collaborationData.artists?.length || 0} collaborators`);
      } catch (parseError) {
        console.error('❌ [Vercel] Failed to parse OpenAI response:', parseError);
        console.error('❌ [Vercel] Raw OpenAI content:', completion.choices[0]?.message?.content);
        await client.end();
        return res.status(503).json({ 
          error: 'Failed to parse OpenAI response',
          message: 'OpenAI returned invalid JSON format',
          artist: artistName,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          timestamp: new Date().toISOString()
        });
      }

      // Build network data structure with comprehensive role consistency
      const nodeMap = new Map<string, NetworkNode>();
      const links: NetworkLink[] = [];

      // Create optimized batch role detection system for performance
      const globalRoleMap = new Map<string, string[]>();
      
      // Batch role detection function for better performance
      const batchDetectRoles = async (peopleList: string[]): Promise<void> => {
        if (peopleList.length === 0) return;
        
        try {
          const peopleListStr = peopleList.map(name => `"${name}"`).join(', ');
          const batchRolePrompt = `For each of these music industry professionals: ${peopleListStr}
          
Return their roles as JSON in this exact format:
{
  "Person Name 1": ["artist", "songwriter"],
  "Person Name 2": ["producer", "songwriter"],
  "Person Name 3": ["artist"]
}

Each person's roles should be from: ["artist", "producer", "songwriter"]. Include ALL roles each person has. Return ONLY the JSON object, no other text.`;

          const openai = new OpenAI({
            apiKey: OPENAI_API_KEY,
          });

          const roleCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: batchRolePrompt }],
            temperature: 0.1,
            max_tokens: 1000,
          });

          const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
          if (roleContent) {
            try {
              const rolesData = JSON.parse(roleContent);
              for (const [personName, roles] of Object.entries(rolesData)) {
                if (Array.isArray(roles) && roles.length > 0) {
                  const validRoles = roles.filter(role => ['artist', 'producer', 'songwriter'].includes(role));
                  if (validRoles.length > 0) {
                    globalRoleMap.set(personName, validRoles);
                    console.log(`✅ [Vercel] Batch detected roles for "${personName}":`, validRoles);
                  }
                }
              }
            } catch {
              console.log(`⚠️ [Vercel] Could not parse batch role detection, falling back to defaults`);
            }
          }
        } catch {
          console.log(`⚠️ [Vercel] Batch role detection failed, falling back to defaults`);
        }
      };
      
      // Quick role lookup with fallback to default
      const getOptimizedRoles = (personName: string, defaultRole: string): string[] => {
        return globalRoleMap.get(personName) || [defaultRole];
      };

      // Pre-detect roles for main artist with dedicated detection
      console.log(`🔍 [Vercel] Detecting roles for main artist "${correctArtistName}"...`);
      let mainArtistTypes = ['artist']; // Default
      
      try {
        const mainArtistRolePrompt = `What roles does ${correctArtistName} have in the music industry? CRITICAL: Search extensively for ALL POSSIBLE ROLES regardless of their popularity or fame level - many people have multiple roles (artist, producer, songwriter). This includes mainstream artists, independent artists, underground artists, regional artists, and emerging artists.

Return ONLY a JSON array of their roles from: ["artist", "producer", "songwriter"]. For example: ["artist", "songwriter"] or ["producer", "songwriter"] or ["artist", "producer", "songwriter"]. 

Investigate thoroughly for multiple roles on ${correctArtistName}, whether they are famous or lesser-known. Return ONLY the JSON array, no other text.`;
        
        const openai = new OpenAI({
          apiKey: OPENAI_API_KEY,
        });

        const roleCompletion = await openai.chat.completions.create({
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

        const roleContent = roleCompletion.choices[0]?.message?.content?.trim();
        if (roleContent) {
          try {
            const detectedRoles = JSON.parse(roleContent);
            if (Array.isArray(detectedRoles) && detectedRoles.length > 0) {
              const validRoles = detectedRoles.filter(role => ['artist', 'producer', 'songwriter'].includes(role));
              if (validRoles.length > 0) {
                mainArtistTypes = validRoles;
                console.log(`✅ [Vercel] Detected main artist roles for "${correctArtistName}":`, mainArtistTypes);
                // Cache for consistency
                globalRoleMap.set(correctArtistName, mainArtistTypes);
              }
            }
          } catch {
            console.log(`⚠️ [Vercel] Could not parse main artist role detection for "${correctArtistName}", using default`);
          }
        }
      } catch {
        console.log(`⚠️ [Vercel] Main artist role detection failed for "${correctArtistName}", using default`);
      }
      
      // Ensure 'artist' is first for main artists if they have that role
      const orderedMainArtistTypes = mainArtistTypes.includes('artist') 
        ? ['artist', ...mainArtistTypes.filter(r => r !== 'artist')]
        : mainArtistTypes;

      // Get Spotify image for main artist
      let mainArtistImage = null;
      let mainArtistSpotifyId = null;
      
      if (spotifyService.isConfigured()) {
        try {
          const spotifyArtist = await spotifyService.searchArtist(correctArtistName);
          if (spotifyArtist) {
            mainArtistImage = spotifyService.getArtistImageUrl(spotifyArtist, 'medium');
            mainArtistSpotifyId = spotifyArtist.id;
            console.log(`🎵 [Vercel] Found Spotify image for main artist "${correctArtistName}": ${mainArtistImage}`);
          }
        } catch (error) {
          console.warn(`Could not fetch Spotify data for ${correctArtistName}:`, error);
        }
      }

      // Add main artist node using correct capitalization from database and detected roles
      const mainNode = {
        id: correctArtistName,
        name: correctArtistName,
        type: orderedMainArtistTypes[0],
        types: orderedMainArtistTypes, // Always an array of all roles
        color: '#FF69B4',
        size: 30,
        artistId: artistMatch.id,
        imageUrl: mainArtistImage,
        spotifyId: mainArtistSpotifyId
      };
      nodeMap.set(correctArtistName, mainNode);
      
      console.log(`🎭 [Vercel] Main artist "${correctArtistName}" initialized with ${orderedMainArtistTypes.length} roles:`, orderedMainArtistTypes);

      // Transform new format to expected format and collect all people for batch role detection
      const collaborators = [];
      const allPeople = new Set<string>();
      
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
      
      if (collaborationData.collaborators) {
        // Add main artist to batch role detection
        allPeople.add(correctArtistName);
        
        for (const person of collaborationData.collaborators) {
          // Skip fake collaborators
          if (isFakeCollaborator(person.name)) {
            console.log(`🚫 [Vercel] Filtering out fake collaborator: "${person.name}"`);
            continue;
          }
          
          allPeople.add(person.name);
          const roles = person.roles || ['producer'];
          for (const role of roles) {
            if (role === 'producer' || role === 'songwriter') {
              collaborators.push({
                name: person.name,
                type: role,
                topCollaborators: person.topCollaborators || []
              });
              // Add branching artists to the batch
              for (const branchingArtist of person.topCollaborators || []) {
                if (branchingArtist !== correctArtistName && !isFakeCollaborator(branchingArtist)) {
                  allPeople.add(branchingArtist);
                }
              }
            }
          }
        }
      } else if (collaborationData.artists) {
        // Fallback for old format
        for (const collaborator of collaborationData.artists) {
          // Skip fake collaborators
          if (isFakeCollaborator(collaborator.name)) {
            console.log(`🚫 [Vercel] Filtering out fake collaborator: "${collaborator.name}"`);
            continue;
          }
          
          collaborators.push(collaborator);
          allPeople.add(collaborator.name);
          for (const branchingArtist of collaborator.topCollaborators || []) {
            if (branchingArtist !== correctArtistName && !isFakeCollaborator(branchingArtist)) {
              allPeople.add(branchingArtist);
            }
          }
        }
      }
      
      // Track whether hallucinations were used
      let hallucinationsUsed = false;

      // If no collaborators found, check if user wants hallucinated data
      if (collaborators.length === 0) {
        const allowHallucinations = req.query.allowHallucinations === 'true';
        
        if (!allowHallucinations) {
          console.log(`⚠️ [Vercel] No collaborators found for "${correctArtistName}", returning no-collaborators response`);
          const singleNodeData = { nodes: [mainNode], links: [] };
          
          await client.end();
          
          // Return special response indicating no collaborators found
          res.json({
            noCollaborators: true,
            artistName: correctArtistName,
            artistId: artistMatch.id,
            singleNodeNetwork: singleNodeData
          });
          return;
        }
        
        // User requested hallucinated data - generate creative network
        console.log(`🎭 [Vercel] No real collaborators found for "${correctArtistName}", generating hallucinated network as requested`);
        hallucinationsUsed = true;
        
        const hallucinatedPrompt = `Create an imaginative collaboration network for ${correctArtistName}. Generate plausible but potentially fictional music industry collaborators who could work with this artist. Include both real and creative professionals.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "roles": ["producer", "songwriter"], 
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
- Include varied collaboration styles that would fit ${correctArtistName}'s music
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
              if (hallucinatedData.collaborators && hallucinatedData.collaborators.length > 0) {
                // Use hallucinated data and continue with normal processing
                collaborationData = hallucinatedData;
                
                // Reprocess collaborators with hallucinated data
                for (const person of hallucinatedData.collaborators) {
                  allPeople.add(person.name);
                  const roles = person.roles || ['producer'];
                  for (const role of roles) {
                    if (role === 'producer' || role === 'songwriter') {
                      collaborators.push({
                        name: person.name,
                        type: role,
                        topCollaborators: person.topCollaborators || []
                      });
                      for (const branchingArtist of person.topCollaborators || []) {
                        if (branchingArtist !== correctArtistName) {
                          allPeople.add(branchingArtist);
                        }
                      }
                    }
                  }
                }
                
                console.log(`✨ [Vercel] Generated ${collaborators.length} hallucinated collaborators for "${correctArtistName}"`);
              }
            } catch {
              console.warn('⚠️ [Vercel] Failed to parse hallucinated data, falling back to single node');
            }
          }
        } catch {
          console.warn('⚠️ [Vercel] Failed to generate hallucinated data, falling back to single node');
        }
        
        // If still no collaborators after hallucination attempt, return single node
        if (collaborators.length === 0) {
          const networkData = { nodes: [mainNode], links: [] };
          await client.end();
          res.json(networkData);
          return;
        }
      }
      
      // Batch detect roles for all people at once for performance
      console.log(`🎭 [Vercel] Batch detecting roles for ${allPeople.size} people...`);
      await batchDetectRoles([...allPeople]);

      // Process producers and songwriters with multi-role consolidation
      for (const collaborator of collaborators) {
        // Check if we already have a node for this person
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Person already exists - add the new role to their types array
          if (!collabNode.types.includes(collaborator.type)) {
            collabNode.types.push(collaborator.type);
            // Ensure types is always unique and sorted
            collabNode.types = Array.from(new Set(collabNode.types)).sort();
            collabNode.type = collabNode.types[0];
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
          // Get Spotify image for collaborator
          let collaboratorImage = null;
          let collaboratorSpotifyId = null;
          
          if (spotifyService.isConfigured()) {
            try {
              const spotifyCollaborator = await spotifyService.searchArtist(collaborator.name);
              if (spotifyCollaborator) {
                collaboratorImage = spotifyService.getArtistImageUrl(spotifyCollaborator, 'medium');
                collaboratorSpotifyId = spotifyCollaborator.id;
                console.log(`🎵 [Vercel] Found Spotify image for collaborator "${collaborator.name}": ${collaboratorImage}`);
              }
            } catch (error) {
              // Continue without image
            }
          }

          // Create new node with optimized role detection
          const enhancedRoles = getOptimizedRoles(collaborator.name, collaborator.type);
          const color = enhancedRoles.includes('producer') ? '#8A2BE2' : '#00CED1';
          collabNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: enhancedRoles[0],
            types: enhancedRoles, // Always an array of all roles
            color: color,
            size: 20, // Smaller size for collaborators
            artistId: null,
            imageUrl: collaboratorImage,
            spotifyId: collaboratorSpotifyId,
            collaborations: collaborator.topCollaborators || []
          };

          // Look up MusicNerd ID for collaborator using enhanced lookup
          const collabMatch = await findArtistInDatabase(client, collaborator.name);
          if (collabMatch) {
            collabNode.artistId = collabMatch.id;
            // Use the normalized/correct name from database for consistency
            collabNode.name = collabMatch.name;
          }

          nodeMap.set(collaborator.name, collabNode);
        }

        // Create link (only once per person, not per role)
        const existingLink = links.find(link => link.source === correctArtistName && link.target === collaborator.name);
        if (!existingLink) {
          links.push({
            source: correctArtistName,
            target: collaborator.name
          });
        }

        // Add branching artists with comprehensive multi-role detection
        for (const branchingArtist of collaborator.topCollaborators || []) {
          if (branchingArtist !== correctArtistName && !nodeMap.has(branchingArtist)) {
            
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

            // Get Spotify image for branching artist
            let branchingArtistImage = null;
            let branchingArtistSpotifyId = null;
            
            if (spotifyService.isConfigured()) {
              try {
                const spotifyBranchingArtist = await spotifyService.searchArtist(branchingArtist);
                if (spotifyBranchingArtist) {
                  branchingArtistImage = spotifyService.getArtistImageUrl(spotifyBranchingArtist, 'medium');
                  branchingArtistSpotifyId = spotifyBranchingArtist.id;
                  console.log(`🎵 [Vercel] Found Spotify image for branching artist "${branchingArtist}": ${branchingArtistImage}`);
                }
              } catch (error) {
                // Continue without image
              }
            }

            const branchNode = {
              id: branchingArtist,
              name: branchingArtist,
              type: branchingRoles[0],
              types: branchingRoles, // Always an array of all roles
              color: '#FF69B4',
              size: 16,
              artistId: null,
              imageUrl: branchingArtistImage,
              spotifyId: branchingArtistSpotifyId
            };

            // Look up MusicNerd ID for branching artist using enhanced lookup
            const branchMatch = await findArtistInDatabase(client, branchingArtist);
            if (branchMatch) {
              branchNode.artistId = branchMatch.id;
              // Use the normalized/correct name from database for consistency
              branchNode.name = branchMatch.name;
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
          const updateQuery = 'UPDATE artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2)';
          await client.query(updateQuery, [JSON.stringify(networkData), correctArtistName]);
          console.log(`💾 [Vercel] Cached network data for ${correctArtistName}`);
        } catch (cacheError) {
          console.warn('⚠️ [Vercel] Failed to cache data:', cacheError);
        }
      } else {
        console.log(`🎭 [Vercel] Skipping cache for ${correctArtistName} due to hallucinated data`);
      }

      await client.end();
      console.log(`✅ [Vercel] Generated network with ${nodes.length} nodes for ${artistName}`);
      
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
    console.error("❌ [Vercel] Error fetching network data:", error);
    console.error('❌ [Vercel] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}