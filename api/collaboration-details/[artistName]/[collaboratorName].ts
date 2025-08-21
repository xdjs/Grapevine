import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Spotify search configuration
const SPOTIFY_SEARCH_CONFIG = {
  MIN_CONFIDENCE_SCORE: 50,        // Minimum score to consider a match
  HIGH_CONFIDENCE_THRESHOLD: 80,   // Score to stop searching early
  MAX_RESULTS_PER_STRATEGY: 5,     // Results to fetch per search strategy
  ENABLE_DETAILED_LOGGING: true,   // Enable detailed search logging
  MARKET: 'US',                    // Default Spotify market for search
  VALIDATE_URLS: true,             // Enable URL validation
  FALLBACK_MARKETS: ['US', 'GB', 'CA', 'AU', 'DE', 'FR'] // Markets to try if main market fails
};

interface CollaborationDetails {
  description: string;
  projects: Array<{
    name: string;
    type: 'song' | 'album' | 'ep' | 'single' | 'mixtape' | 'compilation';
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

      const prompt = `Given the artist "${artistName}" and their collaborator "${collaboratorName}", write a brief sentence describing how they worked together, and cite the real project (song, album, etc) that they worked on together. All instances of collaborations should be mentioned, as well as their personal history (if the information is available). If possible, include any statistics about the popularity of their collaborations when available. For example, if their collaboration/project charted or won any awards, include this information.

Please respond with JSON in this exact format:
{
  "description": "A brief sentence describing their collaboration relationship",
  "projects": [
    {
      "name": "Project Name",
      "type": "song|album|ep|single",
      "year": "YYYY"
    }
  ],
  "personalHistory": "Optional personal history or background information about their relationship"
}

Guidelines:
- Only include real, verified collaborations
- Include specific project names and types
- DO NOT include Spotify URLs or any external links
- Include years when available
- Keep the description concise but informative
- If no real collaborations exist, return empty projects array
- Personal history should be factual and relevant
- Focus on factual collaboration information only
- If possible, include any statistics about the popularity of their collaborations when available. For example, if their collaboration/project charted or won any awards, include this information. Do not make up any information or hallucinate.`;

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
            ).map((project: any) => {
              // CRITICAL: Strip any URLs that OpenAI might have hallucinated
              const cleanProject = {
                name: project.name,
                type: project.type || 'song',
                year: project.year,
                // Explicitly DO NOT include spotifyUrl from OpenAI - we'll add this via validated search
              };
              
              // Log if OpenAI tried to provide URLs (this shouldn't happen with new prompt)
              if (project.spotifyUrl) {
                console.warn(`⚠️ [Collaboration] OpenAI provided Spotify URL for "${project.name}" - ignoring fake URL: ${project.spotifyUrl}`);
              }
              
              return cleanProject;
            });
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
        
        // Enhanced Spotify search with multiple strategies and validation
        for (const project of collaborationDetails.projects) {
          if (!project.spotifyUrl) {
            try {
              console.log(`🔍 [Collaboration] Searching for: "${project.name}" by ${artistName} & ${collaboratorName}`);
              
              // Multiple search strategies in order of preference
              const searchStrategies = [
                // Strategy 1: Exact project name with primary artist
                `"${project.name}" artist:"${artistName}"`,
                // Strategy 2: Project name with both artists
                `"${project.name}" "${artistName}" "${collaboratorName}"`,
                // Strategy 3: Project name with primary artist (no quotes)
                `${project.name} artist:${artistName}`,
                // Strategy 4: Just the project name with some artist context
                `${project.name} ${artistName}`,
                // Strategy 5: Simplified search (fallback)
                `${project.name}`,
              ];

              let bestMatch = null;
              let bestScore = 0;

              for (let i = 0; i < searchStrategies.length; i++) {
                const searchQuery = searchStrategies[i];
                console.log(`🔍 [Collaboration] Strategy ${i + 1}: "${searchQuery}"`);
                
                try {
                  const searchResponse = await axios.get(
                    'https://api.spotify.com/v1/search',
                    {
                      params: {
                        q: searchQuery,
                        type: getSpotifySearchType(project.type),
                        limit: SPOTIFY_SEARCH_CONFIG.MAX_RESULTS_PER_STRATEGY,
                        market: SPOTIFY_SEARCH_CONFIG.MARKET
                      },
                      headers: {
                        'Authorization': `Bearer ${spotifyToken}`
                      }
                    }
                  );

                  const items = searchResponse.data[getSpotifyResponseKey(project.type)]?.items || [];
                  
                  // Validate and score each result
                  for (const item of items) {
                    // Skip items that are not playable (when market is specified)
                    if (item.is_playable === false) {
                      if (SPOTIFY_SEARCH_CONFIG.ENABLE_DETAILED_LOGGING) {
                        console.log(`⏭️ [Collaboration] Skipping "${item.name}" - not playable in ${SPOTIFY_SEARCH_CONFIG.MARKET}`);
                      }
                      continue;
                    }
                    
                    const score = validateSpotifyMatch(item, project, artistName, collaboratorName);
                    
                    // Bonus for tracks that are explicitly marked as playable
                    let finalScore = score;
                    if (item.is_playable === true) {
                      finalScore += 5; // Small bonus for confirmed playable tracks
                    }
                    
                    if (SPOTIFY_SEARCH_CONFIG.ENABLE_DETAILED_LOGGING) {
                      const playableStatus = item.is_playable === true ? '✅' : item.is_playable === false ? '❌' : '❓';
                      console.log(`🎯 [Collaboration] "${item.name}" by ${getArtistNames(item)} - Score: ${finalScore} ${playableStatus}`);
                    }
                    
                    if (finalScore > bestScore && finalScore >= SPOTIFY_SEARCH_CONFIG.MIN_CONFIDENCE_SCORE) {
                      bestMatch = item;
                      bestScore = finalScore;
                    }
                  }

                  // If we found a high-confidence match, stop searching
                  if (bestScore >= SPOTIFY_SEARCH_CONFIG.HIGH_CONFIDENCE_THRESHOLD) {
                    console.log(`✅ [Collaboration] High-confidence match found (${bestScore}), stopping search`);
                    break;
                  }
                  
                } catch (strategyError) {
                  console.warn(`⚠️ [Collaboration] Strategy ${i + 1} failed:`, strategyError.message);
                  continue;
                }
              }

              // Apply the best match if found and validate URL
              if (bestMatch && bestScore >= SPOTIFY_SEARCH_CONFIG.MIN_CONFIDENCE_SCORE) {
                const spotifyUrl = bestMatch.external_urls?.spotify;
                
                if (SPOTIFY_SEARCH_CONFIG.VALIDATE_URLS && spotifyUrl) {
                  // Validate the URL by checking track accessibility
                  const isValidUrl = await validateSpotifyUrl(spotifyUrl, spotifyToken, bestMatch.id);
                  
                  if (isValidUrl) {
                    project.spotifyUrl = spotifyUrl;
                    console.log(`🎵 [Collaboration] Validated match for "${project.name}": "${bestMatch.name}" (Score: ${bestScore}) - ${spotifyUrl}`);
                  } else {
                    console.log(`⚠️ [Collaboration] URL validation failed for "${project.name}": "${bestMatch.name}" - URL not accessible`);
                    
                    // Try to find alternative markets
                    const alternativeUrl = await findAlternativeMarketUrl(bestMatch.id, spotifyToken, project);
                    if (alternativeUrl) {
                      project.spotifyUrl = alternativeUrl;
                      console.log(`🎵 [Collaboration] Found alternative market URL for "${project.name}": ${alternativeUrl}`);
                    }
                  }
                } else {
                  project.spotifyUrl = spotifyUrl;
                  console.log(`🎵 [Collaboration] Best match for "${project.name}": "${bestMatch.name}" (Score: ${bestScore}) - ${spotifyUrl}`);
                }
              } else {
                console.log(`❌ [Collaboration] No suitable match found for "${project.name}" (best score: ${bestScore})`);
              }

            } catch (projectError) {
              console.warn(`⚠️ [Collaboration] Failed to find Spotify URL for ${project.name}:`, projectError.message);
            }
          }
        }
      } catch (spotifyError) {
        console.warn('⚠️ [Collaboration] Spotify enhancement failed:', spotifyError);
        // Continue without Spotify enhancement
      }
    }

    // Final validation: Ensure no fake URLs exist before returning
    collaborationDetails.projects = collaborationDetails.projects.map(project => {
      if (project.spotifyUrl) {
        // Validate URL format and ensure it wasn't hallucinated
        const isValidFormat = project.spotifyUrl.match(/^https:\/\/open\.spotify\.com\/(track|album)\/[a-zA-Z0-9]+$/);
        if (!isValidFormat) {
          console.warn(`⚠️ [Collaboration] Removing invalid Spotify URL format for "${project.name}": ${project.spotifyUrl}`);
          return { ...project, spotifyUrl: undefined };
        }
      }
      return project;
    });

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

// Helper function to validate Spotify search results
function validateSpotifyMatch(spotifyItem: any, project: any, artistName: string, collaboratorName: string): number {
  let score = 0;
  const itemName = spotifyItem.name.toLowerCase();
  const projectName = project.name.toLowerCase();
  
  // Get artist names from the Spotify item
  const spotifyArtists = getArtistNames(spotifyItem).toLowerCase();
  const artistNameLower = artistName.toLowerCase();
  const collaboratorNameLower = collaboratorName.toLowerCase();
  
  // Title matching (most important factor)
  if (itemName === projectName) {
    score += 40; // Exact title match
  } else if (itemName.includes(projectName) || projectName.includes(itemName)) {
    score += 25; // Partial title match
  } else {
    // Check for common variations (remove parentheses, feat., etc.)
    const cleanItemName = itemName.replace(/\s*\([^)]*\)|\s*feat\.?.*|\s*ft\.?.*|\s*featuring.*$/i, '').trim();
    const cleanProjectName = projectName.replace(/\s*\([^)]*\)|\s*feat\.?.*|\s*ft\.?.*|\s*featuring.*$/i, '').trim();
    
    if (cleanItemName === cleanProjectName) {
      score += 35; // Clean title match
    } else if (cleanItemName.includes(cleanProjectName) || cleanProjectName.includes(cleanItemName)) {
      score += 20; // Clean partial match
    }
  }
  
  // Artist matching
  let artistMatches = 0;
  if (spotifyArtists.includes(artistNameLower)) {
    artistMatches++;
    score += 25;
  }
  if (spotifyArtists.includes(collaboratorNameLower)) {
    artistMatches++;
    score += 25;
  }
  
  // Check for common artist name variations
  const artistWords = artistNameLower.split(/\s+/);
  const collaboratorWords = collaboratorNameLower.split(/\s+/);
  
  for (const word of artistWords) {
    if (word.length > 2 && spotifyArtists.includes(word)) {
      score += 5;
    }
  }
  
  for (const word of collaboratorWords) {
    if (word.length > 2 && spotifyArtists.includes(word)) {
      score += 5;
    }
  }
  
  // Bonus for featuring/collaboration indicators
  if (spotifyArtists.includes('feat') || spotifyArtists.includes('featuring') || spotifyArtists.includes('ft')) {
    score += 10;
  }
  
  // Bonus for correct type matching
  const expectedType = getSpotifySearchType(project.type);
  if (expectedType === 'track' && spotifyItem.type === 'track') {
    score += 5; // Track matched correctly
  } else if (expectedType === 'album' && spotifyItem.type === 'album') {
    score += 5; // Album matched correctly
    
    // Additional bonus for EP/album distinction
    if (project.type === 'ep' && spotifyItem.album_type === 'single') {
      score += 5; // EP correctly identified as single album type
    } else if (project.type === 'album' && spotifyItem.album_type === 'album') {
      score += 5; // Full album correctly identified
    }
  }
  
  // Penalty for too many artists (likely compilation)
  const artistCount = spotifyItem.artists?.length || 0;
  if (artistCount > 4) {
    score -= 10;
  }
  
  // Year matching bonus (if available)
  if (project.year) {
    let releaseDate = null;
    
    // For albums, use the release_date directly
    if (spotifyItem.release_date) {
      releaseDate = spotifyItem.release_date;
    }
    // For tracks, use the album's release_date
    else if (spotifyItem.album?.release_date) {
      releaseDate = spotifyItem.album.release_date;
    }
    
    if (releaseDate) {
      const spotifyYear = new Date(releaseDate).getFullYear().toString();
      if (project.year === spotifyYear) {
        score += 15;
      } else if (Math.abs(parseInt(project.year) - parseInt(spotifyYear)) <= 1) {
        score += 5; // Close year match
      }
    }
  }
  
  return Math.max(0, score); // Ensure non-negative score
}

// Helper function to map project types to Spotify search types
function getSpotifySearchType(projectType: string): string {
  switch (projectType) {
    case 'song':
      return 'track';
    case 'album':
      return 'album';
    case 'ep':
      return 'album'; // EPs are searched as albums in Spotify API
    case 'single':
      return 'track'; // Singles are individual tracks
    case 'mixtape':
      return 'album'; // Mixtapes are typically albums in Spotify
    case 'compilation':
      return 'album'; // Compilations are albums in Spotify
    default:
      return 'track'; // Default fallback
  }
}

// Helper function to get the correct response key from Spotify API
function getSpotifyResponseKey(projectType: string): string {
  switch (projectType) {
    case 'song':
    case 'single':
      return 'tracks';
    case 'album':
    case 'ep':
    case 'mixtape':
    case 'compilation':
      return 'albums';
    default:
      return 'tracks'; // Default fallback
  }
}

// Helper function to extract artist names from Spotify item
function getArtistNames(spotifyItem: any): string {
  if (!spotifyItem.artists) return '';
  return spotifyItem.artists.map((artist: any) => artist.name).join(' ');
}

// Function to validate if a Spotify URL is accessible
async function validateSpotifyUrl(spotifyUrl: string, spotifyToken: string, itemId: string): Promise<boolean> {
  try {
    // Extract item ID and type from URL if needed
    const { id: itemIdToCheck, type: itemType } = itemId ? 
      { id: itemId, type: extractSpotifyUrlType(spotifyUrl) } : 
      extractSpotifyIdAndType(spotifyUrl);
    
    if (!itemIdToCheck || !itemType) {
      console.warn(`⚠️ [Collaboration] Could not extract item ID or type from URL: ${spotifyUrl}`);
      return false;
    }

    const axios = (await import('axios')).default;
    
    // Use appropriate endpoint based on item type
    const endpoint = itemType === 'track' ? 
      `https://api.spotify.com/v1/tracks/${itemIdToCheck}` :
      `https://api.spotify.com/v1/albums/${itemIdToCheck}`;
    
    console.log(`🔍 [Collaboration] Validating ${itemType} ${itemIdToCheck} via ${endpoint}`);
    
    const itemResponse = await axios.get(endpoint, {
      params: {
        market: SPOTIFY_SEARCH_CONFIG.MARKET
      },
      headers: {
        'Authorization': `Bearer ${spotifyToken}`
      }
    });

    const item = itemResponse.data;
    
    // Check if item is playable in the specified market
    if (item.is_playable === false) {
      console.log(`⚠️ [Collaboration] ${itemType} ${itemIdToCheck} not playable in market ${SPOTIFY_SEARCH_CONFIG.MARKET}`);
      return false;
    }

    // Check if item has restrictions
    if (item.restrictions && item.restrictions.reason) {
      console.log(`⚠️ [Collaboration] ${itemType} ${itemIdToCheck} has restrictions: ${item.restrictions.reason}`);
      return false;
    }

    // Additional check: verify the URL format is correct
    if (!spotifyUrl.match(/^https:\/\/open\.spotify\.com\/(track|album)\/[a-zA-Z0-9]+$/)) {
      console.warn(`⚠️ [Collaboration] Invalid Spotify URL format: ${spotifyUrl}`);
      return false;
    }

    console.log(`✅ [Collaboration] URL validation successful for ${itemType} ${itemIdToCheck}`);
    return true;

  } catch (error: any) {
    console.warn(`⚠️ [Collaboration] URL validation failed for ${spotifyUrl}:`, error.response?.status || error.message);
    
    // If it's a 404, the item definitely doesn't exist or isn't accessible
    if (error.response?.status === 404) {
      return false;
    }
    
    // For other errors, we'll assume the URL might be valid (network issues, etc.)
    return true;
  }
}

// Function to find alternative market URLs for any Spotify item (track or album)
async function findAlternativeMarketUrl(itemId: string, spotifyToken: string, project: any): Promise<string | null> {
  try {
    const axios = (await import('axios')).default;
    const itemType = getSpotifySearchType(project.type) === 'track' ? 'track' : 'album';
    
    // Try different markets to find one where the item is available
    for (const market of SPOTIFY_SEARCH_CONFIG.FALLBACK_MARKETS) {
      try {
        console.log(`🔍 [Collaboration] Trying market ${market} for ${itemType} ${itemId}`);
        
        const endpoint = itemType === 'track' ? 
          `https://api.spotify.com/v1/tracks/${itemId}` :
          `https://api.spotify.com/v1/albums/${itemId}`;
        
        const itemResponse = await axios.get(endpoint, {
          params: { market },
          headers: {
            'Authorization': `Bearer ${spotifyToken}`
          }
        });

        const item = itemResponse.data;
        
        // Check if item is playable in this market
        if (item.is_playable !== false && !item.restrictions) {
          const alternativeUrl = item.external_urls?.spotify;
          if (alternativeUrl) {
            console.log(`✅ [Collaboration] Found playable ${itemType} in market ${market}: ${alternativeUrl}`);
            return alternativeUrl;
          }
        }
        
      } catch (marketError: any) {
        console.log(`⚠️ [Collaboration] Market ${market} failed for ${itemType} ${itemId}: ${marketError.response?.status || marketError.message}`);
        continue;
      }
    }
    
    console.log(`❌ [Collaboration] No alternative markets found for ${itemType} ${itemId}`);
    return null;
    
  } catch (error: any) {
    console.error(`❌ [Collaboration] Error finding alternative markets for ${itemType} ${itemId}:`, error.message);
    return null;
  }
}

// Helper function to extract Spotify item ID and type from URL
function extractSpotifyIdAndType(spotifyUrl: string): { id: string | null; type: string | null } {
  // Match both track and album URLs
  const trackMatch = spotifyUrl.match(/\/track\/([a-zA-Z0-9]+)/);
  const albumMatch = spotifyUrl.match(/\/album\/([a-zA-Z0-9]+)/);
  
  if (trackMatch) {
    return { id: trackMatch[1], type: 'track' };
  } else if (albumMatch) {
    return { id: albumMatch[1], type: 'album' };
  }
  
  return { id: null, type: null };
}

// Helper function to extract just the type from Spotify URL
function extractSpotifyUrlType(spotifyUrl: string): string | null {
  if (spotifyUrl.includes('/track/')) {
    return 'track';
  } else if (spotifyUrl.includes('/album/')) {
    return 'album';
  }
  return null;
}

// Helper function to extract track ID from Spotify URL (for backwards compatibility)
function extractTrackIdFromUrl(spotifyUrl: string): string | null {
  const { id, type } = extractSpotifyIdAndType(spotifyUrl);
  return type === 'track' ? id : null;
} 