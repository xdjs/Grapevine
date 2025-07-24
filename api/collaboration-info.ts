import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory cache (in production, you'd use Redis or similar)
const collaborationCache = new Map<string, any>();

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
    
    // Check cache first
    const cacheKey = `${artistName.toLowerCase()}-${collaboratorName.toLowerCase()}`;
    if (collaborationCache.has(cacheKey)) {
      console.log(`⚡ [Vercel] Using cached collaboration info for ${artistName} and ${collaboratorName}`);
      return res.json(collaborationCache.get(cacheKey));
    }
    
    // Get environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.error('❌ [Vercel] OPENAI_API_KEY not found');
      return res.status(500).json({ message: 'OpenAI API key not configured' });
    }

    // Generate collaboration information using OpenAI with optimized prompt
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Optimized prompt that still captures role information
    const prompt = `Describe how ${artistName} and ${collaboratorName} worked together. Include:
1. Brief collaboration summary
2. Specific projects (songs/albums) with years and roles
3. Any relevant background

Format as JSON:
{
  "collaborationInfo": "Brief description",
  "projects": [{"name": "Project", "year": "Year", "role": "Role"}],
  "personalHistory": "Background info if relevant"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Faster model
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 300, // Increased for role information
    });

    let collaborationData;
    try {
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      
      collaborationData = JSON.parse(jsonContent);
      
      // Ensure required fields exist
      if (!collaborationData.collaborationInfo) {
        collaborationData.collaborationInfo = "No collaboration information available.";
      }
      if (!collaborationData.projects) {
        collaborationData.projects = [];
      }
      if (!collaborationData.personalHistory) {
        collaborationData.personalHistory = null;
      }
      
    } catch (parseError) {
      console.error('❌ [Vercel] Failed to parse OpenAI response:', parseError);
      
      // Return a fallback response
      collaborationData = {
        collaborationInfo: "Unable to generate detailed collaboration information at this time.",
        projects: [],
        personalHistory: null
      };
    }

    // Add empty spotifyTracks array for compatibility
    collaborationData.spotifyTracks = [];

    // Cache the result
    collaborationCache.set(cacheKey, collaborationData);

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