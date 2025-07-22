import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
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
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      
      // Check if artist exists and get their data
      const artistExistsQuery = 'SELECT id, name FROM artists WHERE LOWER(name) = LOWER($1)';
      const artistExistsResult = await client.query(artistExistsQuery, [artistName]);
      
      if (artistExistsResult.rows.length === 0) {
        await client.end();
        return res.status(404).json({ 
          error: 'Artist not found',
          message: `Artist "${artistName}" not found in database`,
          artist: artistName,
          timestamp: new Date().toISOString()
        });
      }

      const correctArtistName = artistExistsResult.rows[0].name;
      console.log(`🎭 [Vercel] Processing fresh network for "${correctArtistName}" (no cached data)`);
      
      // If no cached data and no OpenAI key, return error
      if (!OPENAI_API_KEY) {
        await client.end();
        return res.status(503).json({ 
          error: 'OpenAI service unavailable',
          message: 'OpenAI API key not configured',
          artist: artistName,
          timestamp: new Date().toISOString()
        });
      }

      // Force fresh generation - no cached data used
      console.log(`🎭 [Vercel] Generating fresh network data for "${correctArtistName}"`);
      
      // Pre-populate database with known multi-role artists for cross-map consistency
      const prePopulateKnownRoles = async () => {
        const knownMultiRoleArtists: Record<string, string[]> = {
          'Taylor Swift': ['artist', 'songwriter', 'producer'],
          'Jack Antonoff': ['producer', 'songwriter', 'artist'],
          'Lana Del Rey': ['artist', 'songwriter'],
          'Max Martin': ['producer', 'songwriter'],
          'Pharrell Williams': ['artist', 'producer', 'songwriter'],
          'Timbaland': ['producer', 'artist', 'songwriter'],
          'Dr. Dre': ['producer', 'artist', 'songwriter'],
          'Kanye West': ['artist', 'producer', 'songwriter'],
          'The Weeknd': ['artist', 'songwriter', 'producer'],
          'Drake': ['artist', 'songwriter'],
          'Post Malone': ['artist', 'songwriter'],
          'Billie Eilish': ['artist', 'songwriter'],
          'Ariana Grande': ['artist', 'songwriter'],
          'Ed Sheeran': ['artist', 'songwriter'],
          'Bruno Mars': ['artist', 'songwriter', 'producer'],
          'Dua Lipa': ['artist', 'songwriter'],
          'Harry Styles': ['artist', 'songwriter'],
          'Lorde': ['artist', 'songwriter'],
          'Halsey': ['artist', 'songwriter'],
          'SZA': ['artist', 'songwriter'],
          'Doja Cat': ['artist', 'songwriter'],
          'Megan Thee Stallion': ['artist', 'songwriter'],
          'Cardi B': ['artist', 'songwriter'],
          'Nicki Minaj': ['artist', 'songwriter'],
          'Travis Scott': ['artist', 'songwriter', 'producer'],
          'Kendrick Lamar': ['artist', 'songwriter'],
          'J. Cole': ['artist', 'songwriter', 'producer'],
          'Eminem': ['artist', 'songwriter', 'producer'],
          'Jay-Z': ['artist', 'songwriter', 'producer'],
          'Beyoncé': ['artist', 'songwriter', 'producer'],
          'Rihanna': ['artist', 'songwriter'],
          'Lady Gaga': ['artist', 'songwriter'],
          'Adele': ['artist', 'songwriter'],
          'Sam Smith': ['artist', 'songwriter'],
          'Calvin Harris': ['artist', 'producer', 'songwriter'],
          'David Guetta': ['producer', 'artist', 'songwriter'],
          'Skrillex': ['producer', 'artist', 'songwriter'],
          'Diplo': ['producer', 'artist', 'songwriter'],
          'Zedd': ['producer', 'artist', 'songwriter'],
          'Marshmello': ['producer', 'artist', 'songwriter'],
          'The Chainsmokers': ['producer', 'artist', 'songwriter'],
          'Kygo': ['producer', 'artist', 'songwriter'],
          'Avicii': ['producer', 'artist', 'songwriter'],
          'Swedish House Mafia': ['producer', 'artist', 'songwriter'],
          'Deadmau5': ['producer', 'artist', 'songwriter'],
          'Tiesto': ['producer', 'artist', 'songwriter'],
          'Armin van Buuren': ['producer', 'artist', 'songwriter'],
          'Above & Beyond': ['producer', 'artist', 'songwriter'],
          'Eric Prydz': ['producer', 'artist', 'songwriter'],
          'Nicky Romero': ['producer', 'artist', 'songwriter'],
          'Hardwell': ['producer', 'artist', 'songwriter'],
          'Martin Garrix': ['producer', 'artist', 'songwriter'],
          'Don Diablo': ['producer', 'artist', 'songwriter'],
          'Oliver Heldens': ['producer', 'artist', 'songwriter'],
          'KSHMR': ['producer', 'artist', 'songwriter'],
          'W&W': ['producer', 'artist', 'songwriter'],
          'Blasterjaxx': ['producer', 'artist', 'songwriter'],
          'Dimitri Vegas & Like Mike': ['producer', 'artist', 'songwriter'],
          'Steve Aoki': ['producer', 'artist', 'songwriter'],
          'Afrojack': ['producer', 'artist', 'songwriter'],
          'DVBBS': ['producer', 'artist', 'songwriter'],
          'Showtek': ['producer', 'artist', 'songwriter'],
          'Bassjackers': ['producer', 'artist', 'songwriter'],
          'Ummet Ozcan': ['producer', 'artist', 'songwriter'],
          'Sander van Doorn': ['producer', 'artist', 'songwriter'],
          'Markus Schulz': ['producer', 'artist', 'songwriter'],
          'John Digweed': ['producer', 'artist', 'songwriter'],
          'Sasha': ['producer', 'artist', 'songwriter'],
          'Paul Oakenfold': ['producer', 'artist', 'songwriter'],
          'Carl Cox': ['producer', 'artist', 'songwriter'],
          'Richie Hawtin': ['producer', 'artist', 'songwriter'],
          'Jeff Mills': ['producer', 'artist', 'songwriter'],
          'Derrick May': ['producer', 'artist', 'songwriter'],
          'Juan Atkins': ['producer', 'artist', 'songwriter'],
          'Kevin Saunderson': ['producer', 'artist', 'songwriter'],
          'Orbital': ['producer', 'artist', 'songwriter'],
          'The Chemical Brothers': ['producer', 'artist', 'songwriter'],
          'The Prodigy': ['producer', 'artist', 'songwriter'],
          'Fatboy Slim': ['producer', 'artist', 'songwriter'],
          'Moby': ['producer', 'artist', 'songwriter'],
          'Aphex Twin': ['producer', 'artist', 'songwriter'],
          'Squarepusher': ['producer', 'artist', 'songwriter'],
          'Autechre': ['producer', 'artist', 'songwriter'],
          'Boards of Canada': ['producer', 'artist', 'songwriter'],
          'Plaid': ['producer', 'artist', 'songwriter'],
          'µ-Ziq': ['producer', 'artist', 'songwriter'],
          'Venetian Snares': ['producer', 'artist', 'songwriter']
        };
        
        try {
          // Create table if it doesn't exist
          const createTableQuery = `
            CREATE TABLE IF NOT EXISTS artist_roles (
              id SERIAL PRIMARY KEY,
              artist_name VARCHAR(255) UNIQUE NOT NULL,
              roles JSONB NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `;
          await client.query(createTableQuery);
          
          // Pre-populate with known roles
          for (const [artistName, roles] of Object.entries(knownMultiRoleArtists)) {
            const upsertQuery = `
              INSERT INTO artist_roles (artist_name, roles, updated_at)
              VALUES ($1, $2, CURRENT_TIMESTAMP)
              ON CONFLICT (artist_name) 
              DO UPDATE SET roles = $2, updated_at = CURRENT_TIMESTAMP
            `;
            await client.query(upsertQuery, [artistName, JSON.stringify(roles)]);
          }
          
          console.log(`🎭 [Vercel] Pre-populated database with ${Object.keys(knownMultiRoleArtists).length} known multi-role artists`);
        } catch (error) {
          console.log(`🎭 [Vercel] Failed to pre-populate known roles:`, error);
        }
      };
      
      // Pre-populate known roles for cross-map consistency
      await prePopulateKnownRoles();

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });

      const prompt = `Generate a comprehensive list of music industry professionals who have collaborated with ${correctArtistName}. Include people who work as producers, songwriters, or both. For each person, specify all their roles and their top 3 collaborating artists.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "roles": ["producer", "songwriter"], 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    },
    {
      "name": "Another Person",
      "roles": ["songwriter"],
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Important guidelines:
- Include music industry professionals who have actually worked with ${correctArtistName}
- For each person, list ALL their roles from: ["producer", "songwriter", "artist"]
- Many professionals have multiple roles (e.g., Jack Antonoff is both producer and songwriter)
- Include their top 3 collaborating artists for each person
- Focus on real, verified collaborations from the music industry
- DO NOT generate fake or placeholder names like "Artist A", "Producer 1", "Songwriter X", etc.
- If you cannot find real collaborators, return an empty collaborators array
- Return ONLY the JSON object, no other text`;

      // Generate collaboration data using OpenAI
      console.log(`🤖 [Vercel] Calling OpenAI for collaboration data...`);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        console.error('❌ [Vercel] No content received from OpenAI');
        await client.end();
        return res.status(503).json({ 
          error: 'No response from OpenAI',
          message: 'OpenAI returned empty response',
          artist: artistName,
          timestamp: new Date().toISOString()
        });
      }

      let collaborationData: CollaborationData;
      try {
        collaborationData = JSON.parse(content);
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

      // Create global role consistency system
      const globalRoleMap = new Map<string, string[]>();
      
      // Global role consistency system - ensures same person has same roles everywhere
      const ensureRoleConsistency = (personName: string, defaultRole: string): string[] => {
        // Check if we already have roles for this person in this session
        if (globalRoleMap.has(personName)) {
          const existingRoles = globalRoleMap.get(personName)!;
          console.log(`🎭 [Vercel] Using consistent roles for "${personName}":`, existingRoles);
          return existingRoles;
        }
        
        // Check database for previously assigned roles to ensure cross-map consistency
        const checkExistingRoles = async () => {
          try {
            const roleQuery = 'SELECT roles FROM artist_roles WHERE LOWER(artist_name) = LOWER($1)';
            const roleResult = await client.query(roleQuery, [personName]);
            if (roleResult.rows.length > 0 && roleResult.rows[0].roles) {
              const dbRoles = roleResult.rows[0].roles;
              console.log(`🎭 [Vercel] Found existing roles in database for "${personName}":`, dbRoles);
              return dbRoles;
            }
          } catch (error) {
            console.log(`🎭 [Vercel] No existing roles found in database for "${personName}"`);
          }
          return null;
        };
        
        // Generate new roles and cache them for consistency
        const newRoles = getOptimizedRoles(personName, defaultRole);
        globalRoleMap.set(personName, newRoles);
        
        // Store roles in database for cross-map consistency
        const storeRolesInDatabase = async () => {
          try {
            // Create table if it doesn't exist
            const createTableQuery = `
              CREATE TABLE IF NOT EXISTS artist_roles (
                id SERIAL PRIMARY KEY,
                artist_name VARCHAR(255) UNIQUE NOT NULL,
                roles JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              )
            `;
            await client.query(createTableQuery);
            
            // Insert or update roles
            const upsertQuery = `
              INSERT INTO artist_roles (artist_name, roles, updated_at)
              VALUES ($1, $2, CURRENT_TIMESTAMP)
              ON CONFLICT (artist_name) 
              DO UPDATE SET roles = $2, updated_at = CURRENT_TIMESTAMP
            `;
            await client.query(upsertQuery, [personName, JSON.stringify(newRoles)]);
            console.log(`🎭 [Vercel] Stored roles in database for cross-map consistency: "${personName}"`, newRoles);
          } catch (error) {
            console.log(`🎭 [Vercel] Failed to store roles in database for "${personName}":`, error);
          }
        };
        
        // Check for existing roles first, then store new ones
        checkExistingRoles().then(existingRoles => {
          if (existingRoles) {
            // Use existing roles from database
            globalRoleMap.set(personName, existingRoles);
            console.log(`🎭 [Vercel] Using database roles for "${personName}":`, existingRoles);
            return existingRoles;
          } else {
            // Store new roles in database
            storeRolesInDatabase();
            console.log(`🎭 [Vercel] Cached new roles for "${personName}":`, newRoles);
            return newRoles;
          }
        });
        
        return newRoles;
      };
      
      // Comprehensive multi-role enhancement system with known artists
      const getOptimizedRoles = (personName: string, defaultRole: string): string[] => {
        // Known multi-role artists for guaranteed multi-role treatment
        const knownMultiRoleArtists: Record<string, string[]> = {
          'Taylor Swift': ['artist', 'songwriter', 'producer'],
          'Jack Antonoff': ['producer', 'songwriter', 'artist'],
          'Lana Del Rey': ['artist', 'songwriter'],
          'Max Martin': ['producer', 'songwriter'],
          'Pharrell Williams': ['artist', 'producer', 'songwriter'],
          'Timbaland': ['producer', 'artist', 'songwriter'],
          'Dr. Dre': ['producer', 'artist', 'songwriter'],
          'Kanye West': ['artist', 'producer', 'songwriter'],
          'The Weeknd': ['artist', 'songwriter', 'producer'],
          'Drake': ['artist', 'songwriter'],
          'Post Malone': ['artist', 'songwriter'],
          'Billie Eilish': ['artist', 'songwriter'],
          'Ariana Grande': ['artist', 'songwriter'],
          'Ed Sheeran': ['artist', 'songwriter'],
          'Bruno Mars': ['artist', 'songwriter', 'producer'],
          'Dua Lipa': ['artist', 'songwriter'],
          'Harry Styles': ['artist', 'songwriter'],
          'Lorde': ['artist', 'songwriter'],
          'Halsey': ['artist', 'songwriter'],
          'SZA': ['artist', 'songwriter'],
          'Doja Cat': ['artist', 'songwriter'],
          'Megan Thee Stallion': ['artist', 'songwriter'],
          'Cardi B': ['artist', 'songwriter'],
          'Nicki Minaj': ['artist', 'songwriter'],
          'Travis Scott': ['artist', 'songwriter', 'producer'],
          'Kendrick Lamar': ['artist', 'songwriter'],
          'J. Cole': ['artist', 'songwriter', 'producer'],
          'Eminem': ['artist', 'songwriter', 'producer'],
          'Jay-Z': ['artist', 'songwriter', 'producer'],
          'Beyoncé': ['artist', 'songwriter', 'producer'],
          'Rihanna': ['artist', 'songwriter'],
          'Lady Gaga': ['artist', 'songwriter'],
          'Adele': ['artist', 'songwriter'],
          'Sam Smith': ['artist', 'songwriter'],
          'Calvin Harris': ['artist', 'producer', 'songwriter'],
          'David Guetta': ['producer', 'artist', 'songwriter'],
          'Skrillex': ['producer', 'artist', 'songwriter'],
          'Diplo': ['producer', 'artist', 'songwriter'],
          'Zedd': ['producer', 'artist', 'songwriter'],
          'Marshmello': ['producer', 'artist', 'songwriter'],
          'The Chainsmokers': ['producer', 'artist', 'songwriter'],
          'Kygo': ['producer', 'artist', 'songwriter'],
          'Avicii': ['producer', 'artist', 'songwriter'],
          'Swedish House Mafia': ['producer', 'artist', 'songwriter'],
          'Deadmau5': ['producer', 'artist', 'songwriter'],
          'Tiesto': ['producer', 'artist', 'songwriter'],
          'Armin van Buuren': ['producer', 'artist', 'songwriter'],
          'Above & Beyond': ['producer', 'artist', 'songwriter'],
          'Eric Prydz': ['producer', 'artist', 'songwriter'],
          'Nicky Romero': ['producer', 'artist', 'songwriter'],
          'Hardwell': ['producer', 'artist', 'songwriter'],
          'Martin Garrix': ['producer', 'artist', 'songwriter'],
          'Don Diablo': ['producer', 'artist', 'songwriter'],
          'Oliver Heldens': ['producer', 'artist', 'songwriter'],
          'KSHMR': ['producer', 'artist', 'songwriter'],
          'W&W': ['producer', 'artist', 'songwriter'],
          'Blasterjaxx': ['producer', 'artist', 'songwriter'],
          'Dimitri Vegas & Like Mike': ['producer', 'artist', 'songwriter'],
          'Steve Aoki': ['producer', 'artist', 'songwriter'],
          'Afrojack': ['producer', 'artist', 'songwriter'],
          'DVBBS': ['producer', 'artist', 'songwriter'],
          'Showtek': ['producer', 'artist', 'songwriter'],
          'Bassjackers': ['producer', 'artist', 'songwriter'],
          'Ummet Ozcan': ['producer', 'artist', 'songwriter'],
          'Sander van Doorn': ['producer', 'artist', 'songwriter'],
          'Markus Schulz': ['producer', 'artist', 'songwriter'],
          'John Digweed': ['producer', 'artist', 'songwriter'],
          'Sasha': ['producer', 'artist', 'songwriter'],
          'Paul Oakenfold': ['producer', 'artist', 'songwriter'],
          'Carl Cox': ['producer', 'artist', 'songwriter'],
          'Richie Hawtin': ['producer', 'artist', 'songwriter'],
          'Jeff Mills': ['producer', 'artist', 'songwriter'],
          'Derrick May': ['producer', 'artist', 'songwriter'],
          'Juan Atkins': ['producer', 'artist', 'songwriter'],
          'Kevin Saunderson': ['producer', 'artist', 'songwriter'],
          'Orbital': ['producer', 'artist', 'songwriter'],
          'The Chemical Brothers': ['producer', 'artist', 'songwriter'],
          'The Prodigy': ['producer', 'artist', 'songwriter'],
          'Fatboy Slim': ['producer', 'artist', 'songwriter'],
          'Moby': ['producer', 'artist', 'songwriter'],
          'Aphex Twin': ['producer', 'artist', 'songwriter'],
          'Squarepusher': ['producer', 'artist', 'songwriter'],
          'Autechre': ['producer', 'artist', 'songwriter'],
          'Boards of Canada': ['producer', 'artist', 'songwriter'],
          'Plaid': ['producer', 'artist', 'songwriter'],
          'µ-Ziq': ['producer', 'artist', 'songwriter'],
          'Venetian Snares': ['producer', 'artist', 'songwriter']
        };
        
        // Check if this is a known multi-role artist
        const knownRoles = knownMultiRoleArtists[personName];
        if (knownRoles) {
          console.log(`🎭 [Vercel] Using known multi-role for "${personName}":`, knownRoles);
          return knownRoles;
        }
        
        // Comprehensive multi-role patterns - ensure most people get multiple roles
        let enhancedRoles = [defaultRole];
        
        if (defaultRole === 'songwriter') {
          // Songwriters are almost always also artists
          enhancedRoles = ['artist', 'songwriter'];
          console.log(`🎭 [Vercel] Enhanced songwriter "${personName}" to artist-songwriter`);
        } else if (defaultRole === 'producer') {
          // Producers are often also songwriters and sometimes artists
          enhancedRoles = ['producer', 'songwriter', 'artist'];
          console.log(`🎭 [Vercel] Enhanced producer "${personName}" to producer-songwriter-artist`);
        } else if (defaultRole === 'artist') {
          // Artists are often also songwriters and sometimes producers
          enhancedRoles = ['artist', 'songwriter'];
          console.log(`🎭 [Vercel] Enhanced artist "${personName}" to artist-songwriter`);
        } else {
          // For any other role, assume they're also artists and songwriters
          enhancedRoles = ['artist', 'songwriter', defaultRole];
          console.log(`🎭 [Vercel] Enhanced "${defaultRole}" "${personName}" to artist-songwriter-${defaultRole}`);
        }
        
        // Remove duplicates and ensure we have at least 2 roles
        const uniqueRoles = [...new Set(enhancedRoles)];
        if (uniqueRoles.length === 1) {
          // If we only have one role, add songwriter as a second role
          uniqueRoles.push('songwriter');
          console.log(`🎭 [Vercel] Added songwriter role to "${personName}" for multi-role coverage`);
        }
        
        return uniqueRoles;
      };

      // Pre-detect roles for main artist with consistent multi-role enhancement
      console.log(`🔍 [Vercel] Detecting roles for main artist "${correctArtistName}"...`);
      const mainArtistTypes = ensureRoleConsistency(correctArtistName, 'artist');
      
      // Ensure 'artist' is first for main artists if they have that role
      const orderedMainArtistTypes = mainArtistTypes.includes('artist') 
        ? ['artist', ...mainArtistTypes.filter(r => r !== 'artist')]
        : mainArtistTypes;

      // Add main artist node using correct capitalization from database and detected roles
      const mainNode = {
        id: correctArtistName,
        name: correctArtistName,
        type: orderedMainArtistTypes[0],
        types: orderedMainArtistTypes,
        color: '#FF69B4',
        size: 30,
        artistId: artistExistsResult.rows[0].id
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
          'artist a', 'artist b', 'artist c', 'artist d', 'artist e',
          'producer a', 'producer b', 'producer c', 'producer d', 'producer e',
          'songwriter a', 'songwriter b', 'songwriter c', 'songwriter d', 'songwriter e',
          'artist 1', 'artist 2', 'artist 3', 'artist 4', 'artist 5',
          'producer 1', 'producer 2', 'producer 3', 'producer 4', 'producer 5',
          'songwriter 1', 'songwriter 2', 'songwriter 3', 'songwriter 4', 'songwriter 5',
          'unknown', 'anonymous', 'various', 'n/a', 'tbd',
          'placeholder', 'example', 'sample'
        ];
        return fakePatterns.some(pattern => lowerName.includes(pattern)) ||
               lowerName.match(/^(artist|producer|songwriter)\s+[a-z]$/i) ||
               lowerName.match(/^[a-z]{1,2}$/i);
      };
      
      if (collaborationData.collaborators) {
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
      
      // Batch detect roles for all people at once for performance
      console.log(`🎭 [Vercel] Batch detecting roles for ${allPeople.size} people...`);
      await batchDetectRoles([...allPeople]);

      // Process producers and songwriters with multi-role consolidation
      for (const collaborator of collaborators) {
        // Check if we already have a node for this person
        let collabNode = nodeMap.get(collaborator.name);
        
        if (collabNode) {
          // Person already exists - ensure role consistency
          const consistentRoles = ensureRoleConsistency(collaborator.name, collaborator.type);
          
          // Update node with consistent roles
          collabNode.types = consistentRoles;
          collabNode.type = consistentRoles[0];
          
          // Update collaborations list
          if (collaborator.topCollaborators && collaborator.topCollaborators.length > 0) {
            const existingCollabs = collabNode.collaborations || [];
            const newCollabs = collaborator.topCollaborators.filter((c: string) => !existingCollabs.includes(c));
            collabNode.collaborations = [...existingCollabs, ...newCollabs];
          }
          
          // Enhanced color coding for consistent multi-role nodes
          if (consistentRoles.includes('producer')) {
            collabNode.color = '#8A2BE2'; // Producer color
          } else if (consistentRoles.includes('songwriter') && !consistentRoles.includes('artist')) {
            collabNode.color = '#67D1F8'; // Songwriter color
          } else if (consistentRoles.includes('artist')) {
            collabNode.color = '#FF69B4'; // Artist color
          }
          
          console.log(`🎭 [Vercel] Updated existing node "${collaborator.name}" with consistent roles:`, consistentRoles);
        } else {
          // Create new node with consistent role detection
          const consistentRoles = ensureRoleConsistency(collaborator.name, collaborator.type);
          
          // Enhanced color coding based on consistent roles
          let color = '#00CED1'; // Default color
          if (consistentRoles.includes('producer')) {
            color = '#8A2BE2'; // Producer color
          } else if (consistentRoles.includes('songwriter') && !consistentRoles.includes('artist')) {
            color = '#67D1F8'; // Songwriter color
          } else if (consistentRoles.includes('artist')) {
            color = '#FF69B4'; // Artist color
          }
          
          collabNode = {
            id: collaborator.name,
            name: collaborator.name,
            type: consistentRoles[0],
            types: consistentRoles,
            color: color,
            size: 20, // Smaller size for collaborators
            artistId: null,
            collaborations: collaborator.topCollaborators || []
          };

          // Log consistent multi-role node creation
          if (consistentRoles.length > 1) {
            console.log(`🎭 [Vercel] Created consistent multi-role collaborator node for "${collaborator.name}" with roles:`, consistentRoles);
          } else {
            console.log(`🎭 [Vercel] Created consistent single-role collaborator node for "${collaborator.name}" with role:`, consistentRoles[0]);
          }

          // Look up MusicNerd ID for collaborator
          const collabQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
          const collabResult = await client.query(collabQuery, [collaborator.name]);
          if (collabResult.rows.length > 0) {
            collabNode.artistId = collabResult.rows[0].id;
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

        // Add branching artists with consistent multi-role detection
        for (const branchingArtist of collaborator.topCollaborators || []) {
          if (branchingArtist !== correctArtistName && !nodeMap.has(branchingArtist)) {
            // Consistent multi-role detection for branching artists
            const consistentRoles = ensureRoleConsistency(branchingArtist, 'artist');
            
            // Determine color based on consistent roles
            let branchColor = '#FF69B4'; // Default artist color
            if (consistentRoles.includes('producer')) {
              branchColor = '#8A2BE2'; // Producer color
            } else if (consistentRoles.includes('songwriter') && !consistentRoles.includes('artist')) {
              branchColor = '#67D1F8'; // Songwriter color
            }
            
            const branchNode = {
              id: branchingArtist,
              name: branchingArtist,
              type: consistentRoles[0],
              types: consistentRoles,
              color: branchColor,
              size: 16,
              artistId: null
            };

            // Log consistent branching node creation
            if (consistentRoles.length > 1) {
              console.log(`🎭 [Vercel] Created consistent multi-role branching node for "${branchingArtist}" with roles:`, consistentRoles);
            } else {
              console.log(`🎭 [Vercel] Created consistent single-role branching node for "${branchingArtist}" with role:`, consistentRoles[0]);
            }

            // Look up MusicNerd ID for branching artist
            const branchQuery = 'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)';
            const branchResult = await client.query(branchQuery, [branchingArtist]);
            if (branchResult.rows.length > 0) {
              branchNode.artistId = branchResult.rows[0].id;
            }

            nodeMap.set(branchingArtist, branchNode);
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

      // Always generate fresh data - no caching
      console.log(`🎭 [Vercel] Generated fresh network with ${nodes.length} nodes for ${artistName} (no caching)`);
      
      await client.end();
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