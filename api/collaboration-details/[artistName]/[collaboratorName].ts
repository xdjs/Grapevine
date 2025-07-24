import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CollaborationDetails {
  description: string;
  projects: Array<{
    name: string;
    type: 'song' | 'album' | 'ep' | 'single';
    spotifyUrl?: string;
    year?: string;
  }>;
  personalHistory?: string;
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
    const { artistName, collaboratorName } = req.query;
    
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    if (!collaboratorName || typeof collaboratorName !== 'string') {
      return res.status(400).json({ message: 'Collaborator name is required' });
    }

    console.log(`🤝 [Collaboration] Fetching details for ${artistName} and ${collaboratorName}`);

    // Get environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!OPENAI_API_KEY) {
      console.error('❌ [Collaboration] OpenAI API key not found');
      return res.status(503).json({ 
        message: 'OpenAI API key not configured',
        error: 'OpenAI API key is required for collaboration details'
      });
    }

    // Try MusicBrainz first for structured collaboration data
    console.log(`🎵 [Collaboration] Checking MusicBrainz for collaboration data`);
    
    let collaborationDetails: CollaborationDetails = {
      description: "",
      projects: [],
      personalHistory: ""
    };
    
    try {
      // Import MusicBrainz service
      const { musicBrainzService } = await import('../../../../server/musicbrainz.js');
      
      // Get collaboration data from MusicBrainz
      const musicBrainzData = await musicBrainzService.getArtistCollaborations(artistName);
      
      // Find specific collaboration with the target collaborator
      const specificCollaboration = musicBrainzData.artists.find(artist => 
        artist.name.toLowerCase() === collaboratorName.toLowerCase()
      );
      
             if (specificCollaboration) {
         console.log(`✅ [Collaboration] Found MusicBrainz data for ${artistName} and ${collaboratorName}`);
         
         // Build description from MusicBrainz data
         const relationType = specificCollaboration.type;
         const relationDescription = specificCollaboration.relation;
         
         collaborationDetails.description = `${artistName} and ${collaboratorName} have collaborated as ${relationType}s. ${relationDescription}`;
         
         // Extract projects from collaborative works
         const collaborativeWorks = musicBrainzData.works.filter(work => 
           work.collaborators.includes(collaboratorName) || 
           work.title.toLowerCase().includes(collaboratorName.toLowerCase())
         );
         
         collaborationDetails.projects = collaborativeWorks.map(work => ({
           name: work.title,
           type: 'song' as const, // Default to song, could be enhanced with work type detection
           year: undefined, // MusicBrainz doesn't always provide year in this format
           spotifyUrl: undefined // Will be enhanced by Spotify API later
         }));
         
         console.log(`📝 [Collaboration] Found ${collaborationDetails.projects.length} projects from MusicBrainz`);
         
         // Also try to get more detailed collaboration info by searching both artists
         try {
           const collaboratorData = await musicBrainzService.getArtistCollaborations(collaboratorName);
           const reverseCollaboration = collaboratorData.artists.find(artist => 
             artist.name.toLowerCase() === artistName.toLowerCase()
           );
           
           if (reverseCollaboration) {
             console.log(`✅ [Collaboration] Found reverse collaboration data`);
             // Add any additional projects from the reverse lookup
             const additionalWorks = collaboratorData.works.filter(work => 
               work.collaborators.includes(artistName) || 
               work.title.toLowerCase().includes(artistName.toLowerCase())
             );
             
             const existingProjectNames = new Set(collaborationDetails.projects.map(p => p.name.toLowerCase()));
             const newProjects = additionalWorks
               .filter(work => !existingProjectNames.has(work.title.toLowerCase()))
               .map(work => ({
                 name: work.title,
                 type: 'song' as const,
                 year: undefined,
                 spotifyUrl: undefined
               }));
             
             collaborationDetails.projects = [...collaborationDetails.projects, ...newProjects];
             console.log(`📝 [Collaboration] Added ${newProjects.length} additional projects from reverse lookup`);
           }
         } catch (reverseError) {
           console.warn(`⚠️ [Collaboration] Reverse lookup failed:`, reverseError);
         }
       } else {
         console.log(`⚠️ [Collaboration] No MusicBrainz data found for ${artistName} and ${collaboratorName}`);
       }
    } catch (musicBrainzError) {
      console.warn(`⚠️ [Collaboration] MusicBrainz lookup failed:`, musicBrainzError);
    }
    
    // If MusicBrainz didn't provide enough data, fall back to OpenAI
    if (!collaborationDetails.description || collaborationDetails.projects.length === 0) {
      console.log(`🤖 [Collaboration] Falling back to OpenAI for collaboration details`);
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });

      const prompt = `Given the artist "${artistName}" and their collaborator "${collaboratorName}", write a brief sentence describing how they worked together, and cite the real project (song, album, etc) that they worked on together. All instances of collaborations should be mentioned, as well as their personal history (if the information is available).

Please respond with JSON in this exact format:
{
  "description": "A brief sentence describing their collaboration relationship",
  "projects": [
    {
      "name": "Project Name",
      "type": "song|album|ep|single",
      "year": "YYYY",
      "spotifyUrl": "https://open.spotify.com/track/... or https://open.spotify.com/album/..."
    }
  ],
  "personalHistory": "Optional personal history or background information about their relationship"
}

Guidelines:
- Only include real, verified collaborations
- Include specific project names and types
- If you find Spotify URLs for the projects, include them
- Include years when available
- Keep the description concise but informative
- If no real collaborations exist, return empty projects array
- Personal history should be factual and relevant`;

          const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a music industry expert. Provide accurate information about real collaborations between artists. Only include verified, factual information. Do not create fictional collaborations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      try {
        const openaiContent = completion.choices[0]?.message?.content;
        
        if (!openaiContent) {
          console.error('❌ [Collaboration] OpenAI returned empty response');
          // Continue with existing MusicBrainz data if available
        } else {
          // Try to extract JSON from OpenAI response
          let jsonContent = openaiContent.trim();
          
          // Remove markdown code blocks if present
          jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
          
          // Look for JSON object boundaries
          const jsonStart = jsonContent.indexOf('{');
          const jsonEnd = jsonContent.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
          }
          
          const openaiDetails = JSON.parse(jsonContent);
          
          // Merge OpenAI data with MusicBrainz data
          if (openaiDetails.description && !collaborationDetails.description) {
            collaborationDetails.description = openaiDetails.description;
          }
          
          if (openaiDetails.projects && openaiDetails.projects.length > 0) {
            // Add OpenAI projects that aren't already in MusicBrainz data
            const existingProjectNames = new Set(collaborationDetails.projects.map(p => p.name.toLowerCase()));
            const newProjects = openaiDetails.projects.filter((project: any) => 
              !existingProjectNames.has(project.name.toLowerCase())
            );
            collaborationDetails.projects = [...collaborationDetails.projects, ...newProjects];
          }
          
          if (openaiDetails.personalHistory && !collaborationDetails.personalHistory) {
            collaborationDetails.personalHistory = openaiDetails.personalHistory;
          }
          
          console.log(`✅ [Collaboration] Merged OpenAI data with ${openaiDetails.projects?.length || 0} additional projects`);
        }
        
      } catch (parseError) {
        console.error('❌ [Collaboration] Failed to parse OpenAI response:', parseError);
        // Continue with existing MusicBrainz data
      }
    }
    
    // Validate the final structure
    if (!collaborationDetails.description) {
      collaborationDetails.description = `No specific collaboration details found between ${artistName} and ${collaboratorName}. This could be because they haven't collaborated directly, or the collaboration information isn't available in our databases.`;
    }
    
    if (!collaborationDetails.projects) {
      collaborationDetails.projects = [];
    }
    
    console.log(`✅ [Collaboration] Final result: ${collaborationDetails.projects.length} projects from combined sources`);
    
    // Add a note about data sources if we have projects
    if (collaborationDetails.projects.length > 0) {
      collaborationDetails.description += ` Data sourced from MusicBrainz and enhanced with AI-generated information.`;
    }

    // If Spotify is configured, try to enhance the projects with Spotify data
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
      try {
        console.log(`🎵 [Collaboration] Enhancing with Spotify data`);
        
        // Get Spotify access token
        const axios = (await import('axios')).default;
        const tokenResponse = await axios.post(
          'https://accounts.spotify.com/api/token',
          'grant_type=client_credentials',
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
            }
          }
        );

        const spotifyToken = tokenResponse.data.access_token;
        
        // Try to find Spotify URLs for the projects
        for (const project of collaborationDetails.projects) {
          if (!project.spotifyUrl) {
            try {
              // Search for the project on Spotify
              const searchResponse = await axios.get(
                'https://api.spotify.com/v1/search',
                {
                  params: {
                    q: `${project.name} ${artistName} ${collaboratorName}`,
                    type: project.type === 'song' ? 'track' : 'album',
                    limit: 1
                  },
                  headers: {
                    'Authorization': `Bearer ${spotifyToken}`
                  }
                }
              );

              const items = searchResponse.data[project.type === 'song' ? 'tracks' : 'albums']?.items;
              if (items && items.length > 0) {
                const item = items[0];
                project.spotifyUrl = item.external_urls?.spotify;
                console.log(`🎵 [Collaboration] Found Spotify URL for ${project.name}: ${project.spotifyUrl}`);
              }
            } catch (spotifyError) {
              console.warn(`⚠️ [Collaboration] Failed to find Spotify URL for ${project.name}:`, spotifyError);
            }
          }
        }
      } catch (spotifyError) {
        console.warn('⚠️ [Collaboration] Spotify enhancement failed:', spotifyError);
        // Continue without Spotify enhancement
      }
    }

    console.log(`✅ [Collaboration] Returning collaboration details for ${artistName} and ${collaboratorName}`);
    res.json(collaborationDetails);
    
  } catch (error) {
    console.error("❌ [Collaboration] Error fetching collaboration details:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 