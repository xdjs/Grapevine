import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { artistName } = req.body;

    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const prompt = `Generate 5 fun, interesting, and accurate facts about the musician/artist "${artistName}". 
    
    Requirements:
    - Each fact should be 1-2 sentences long
    - Focus on their career, achievements, personal life, collaborations, and interesting trivia
    - Make sure facts are factual and not speculative
    - Include a mix of different types of information
    - Make them engaging and fun to read
    - Avoid controversial or negative information
    
    Format the response as a JSON array of strings, each string being one fact.
    
    Example format:
    ["Fact 1 about the artist", "Fact 2 about the artist", "Fact 3 about the artist", "Fact 4 about the artist", "Fact 5 about the artist"]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a music expert who provides accurate, interesting facts about musicians and artists. Always respond with valid JSON arrays containing exactly 5 facts."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse the JSON response
    let facts: string[];
    try {
      // Clean up the response text to extract JSON
      const jsonMatch = responseText.match(/\[.*\]/s);
      if (jsonMatch) {
        facts = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText);
      throw new Error('Invalid response format from AI');
    }

    // Validate the facts array
    if (!Array.isArray(facts) || facts.length !== 5 || !facts.every(fact => typeof fact === 'string')) {
      throw new Error('Invalid facts format from AI');
    }

    // Filter out any facts that are too long or inappropriate
    const validFacts = facts.filter(fact => 
      fact.length > 10 && 
      fact.length < 200 && 
      !fact.toLowerCase().includes('died') &&
      !fact.toLowerCase().includes('death') &&
      !fact.toLowerCase().includes('scandal')
    );

    if (validFacts.length < 3) {
      throw new Error('Not enough valid facts generated');
    }

    console.log(`✅ Generated ${validFacts.length} facts for artist: ${artistName}`);

    res.json({ 
      facts: validFacts,
      artistName,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating facts:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: 60
        });
      }
      
      if (error.message.includes('quota')) {
        return res.status(429).json({ 
          error: 'API quota exceeded. Please try again later.',
          retryAfter: 3600
        });
      }
    }

    res.status(500).json({ 
      error: 'Failed to generate facts',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
