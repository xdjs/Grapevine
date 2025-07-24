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

    // Generate collaboration information using OpenAI with simplified prompt
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Much simpler and faster prompt
    const prompt = `Briefly describe how ${artistName} and ${collaboratorName} worked together. Include specific songs/albums they collaborated on. Keep it under 100 words.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Faster model
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 150, // Much smaller response
    });

    let collaborationInfo = "No collaboration information available.";
    try {
      const content = completion.choices[0]?.message?.content;
      if (content) {
        collaborationInfo = content.trim();
      }
    } catch (error) {
      console.error('❌ [Vercel] Failed to get OpenAI response:', error);
    }

    // Create simplified response structure
    const collaborationData = {
      collaborationInfo: collaborationInfo,
      projects: [], // Simplified - no complex project parsing
      personalHistory: null,
      spotifyTracks: [] // Simplified - no Spotify API calls
    };

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