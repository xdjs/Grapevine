import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const { artistName, collaboratorName } = req.query;
    
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    if (!collaboratorName || typeof collaboratorName !== 'string') {
      return res.status(400).json({ message: 'Collaborator name is required' });
    }

    console.log(`🤝 [Vercel] Collaboration info request for: ${artistName} and ${collaboratorName}`);
    
    // Get environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!OPENAI_API_KEY) {
      console.error('❌ [Vercel] OPENAI_API_KEY not found');
      return res.status(500).json({ message: 'OpenAI API key not configured' });
    }

    // Generate collaboration information using OpenAI
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const prompt = `Given the artist "${artistName}" and their collaborator "${collaboratorName}", write a brief sentence describing how they worked together, and cite the real project (song, album, etc) that they worked on together. All instances of collaborations should be mentioned, as well as their personal history (if the information is available).

Please respond with JSON in this exact format:
{
  "collaborationInfo": "Brief description of their collaboration and relationship",
  "projects": [
    {
      "name": "Project Name (Song/Album)",
      "year": "Year",
      "role": "Role in project",
      "spotifyUrl": "Spotify URL if available"
    }
  ],
  "personalHistory": "Any relevant personal history or background information"
}

Guidelines:
- Focus on real, verified collaborations
- Include specific songs, albums, or projects they worked on together
- If you cannot find real collaborations, return empty projects array
- Keep the collaboration info concise but informative
- Include Spotify URLs when possible for the projects
- Return ONLY the JSON object, no other text`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    let collaborationData;
    try {
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }
      collaborationData = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ [Vercel] Failed to parse OpenAI response:', parseError);
      return res.status(500).json({ 
        message: 'Failed to generate collaboration information',
        error: 'Invalid response format'
      });
    }

    // If Spotify credentials are available, try to enhance with Spotify data
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
      try {
        // Get Spotify access token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
          },
          body: 'grant_type=client_credentials'
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;

          // Search for collaborative tracks
          const searchQuery = `${artistName} ${collaboratorName}`;
          const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const tracks = searchData.tracks?.items || [];

            // Add Spotify tracks to the response
            collaborationData.spotifyTracks = tracks.map((track: any) => ({
              name: track.name,
              artists: track.artists.map((artist: any) => artist.name),
              album: track.album.name,
              spotifyUrl: track.external_urls.spotify,
              releaseDate: track.album.release_date
            }));
          }
        }
      } catch (spotifyError) {
        console.warn('⚠️ [Vercel] Spotify API error:', spotifyError);
        // Continue without Spotify data
      }
    }

    console.log(`✅ [Vercel] Generated collaboration info for ${artistName} and ${collaboratorName}`);
    res.json(collaborationData);

  } catch (error) {
    console.error('❌ [Vercel] Collaboration info error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 