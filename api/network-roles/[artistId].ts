import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Returns role arrays for nodes in a previously generated network, by artistId.
 * Response shape: { [personName: string]: ("artist"|"producer"|"songwriter")[] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!CONNECTION_STRING) {
      return res.status(500).json({ message: 'Database connection not configured' });
    }
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ message: 'OpenAI API key not configured' });
    }

    const { Client } = await import('pg');
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // Load existing webmapdata to get the list of people
    const artistResult = await client.query('SELECT name, webmapdata FROM artists WHERE id = $1', [artistId]);
    if (artistResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({ message: `Artist with ID "${artistId}" not found in database.` });
    }

    const mainArtistName: string = artistResult.rows[0].name;
    const webmap: { nodes?: Array<{ name: string }>} = artistResult.rows[0].webmapdata || { nodes: [] };
    const people = Array.from(new Set((webmap.nodes || []).map((n) => n.name).filter(Boolean)));

    if (people.length === 0) {
      await client.end();
      return res.json({});
    }

    // Ask OpenAI for batch roles
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const peopleListStr = people.map((p) => `"${p}"`).join(', ');
    const batchRolePrompt = `For each of these music industry professionals: ${peopleListStr}

Return their roles as JSON in this exact format:
{
  "Person Name 1": ["artist", "songwriter"],
  "Person Name 2": ["producer", "songwriter"],
  "Person Name 3": ["artist"]
}

Each person's roles should be from: ["artist", "producer", "songwriter"]. Include ALL roles each person has. Return ONLY the JSON object, no other text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: batchRolePrompt }],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    let rolesMap: Record<string, string[]> = {};
    if (content) {
      try {
        const jsonContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        rolesMap = JSON.parse(jsonContent);
      } catch {
        rolesMap = {};
      }
    }

    await client.end();
    return res.json(rolesMap);
  } catch (error) {
    console.error('❌ [Vercel] Error fetching network roles:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


