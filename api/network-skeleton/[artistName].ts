import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NetworkNodeSkeleton {
  id: string;
  name: string;
  type: string; // coarse type for quick coloring; can be refined later
  types?: string[]; // optional; enrichment will refine
  color: string;
  size: number;
  artistId: string | null;
}

interface NetworkLinkSkeleton {
  source: string;
  target: string;
}

interface CollaboratorEntry {
  name: string;
  roles?: string[];
  topCollaborators?: string[];
}

interface SkeletonResponseShape {
  collaborators?: CollaboratorEntry[];
}

function normalizeArtistName(name: string): string {
  let normalized = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  normalized = normalized.replace(/\s+(aka|also known as|formerly)\s+.*$/i, '').trim();
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

async function findArtistInDatabase(client: any, artistName: string): Promise<{ id: string; name: string } | null> {
  const variations = [artistName, normalizeArtistName(artistName)];
  const uniqueVariations = [...new Set(variations)];
  for (const variation of uniqueVariations) {
    if (!variation || variation.length < 2) continue;
    const query = 'SELECT id, name FROM artists WHERE LOWER(name) = LOWER($1)';
    const result = await client.query(query, [variation]);
    if (result.rows.length > 0) {
      return { id: String(result.rows[0].id), name: result.rows[0].name };
    }
  }
  return null;
}

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
    const { artistName } = req.query;
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!CONNECTION_STRING) {
      return res.status(500).json({ message: 'Database connection not configured' });
    }
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ 
        error: 'OpenAI API key not configured',
        message: 'Network generation requires OPENAI_API_KEY',
      });
    }

    const { Client } = await import('pg');
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    const artistMatch = await findArtistInDatabase(client, artistName);
    if (!artistMatch) {
      await client.end();
      return res.status(404).json({ message: `Artist "${artistName}" not found in database.` });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const prompt = `List real collaborators for ${artistMatch.name}. Return ONLY JSON in this exact shape:
{ "collaborators": [ { "name": "Person", "roles": ["producer","songwriter","artist"], "topCollaborators": ["Other Artist 1","Other Artist 2"] } ] }
Rules: Be comprehensive for well-documented mainstream artists; be selective but accurate for lesser-known artists. No extra text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1200,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '';
    let jsonText = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) jsonText = jsonText.substring(start, end + 1);

    let parsed: SkeletonResponseShape = { collaborators: [] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // keep empty
    }

    const nodeMap = new Map<string, NetworkNodeSkeleton>();
    const links: NetworkLinkSkeleton[] = [];

    // Main artist node (minimal roles for speed)
    const mainNode: NetworkNodeSkeleton = {
      id: artistMatch.name,
      name: artistMatch.name,
      type: 'artist',
      types: ['artist'],
      color: '#FF69B4',
      size: 30,
      artistId: artistMatch.id,
    };
    nodeMap.set(mainNode.name, mainNode);

    const collaborators = parsed.collaborators ?? [];
    for (const person of collaborators) {
      const roles = Array.isArray(person.roles) && person.roles.length > 0 ? person.roles : ['producer'];
      const color = roles.includes('producer') ? '#8A2BE2' : roles.includes('artist') ? '#FF69B4' : '#00CED1';
      const collabNode: NetworkNodeSkeleton = {
        id: person.name,
        name: person.name,
        type: roles[0],
        types: roles,
        color,
        size: 20,
        artistId: null,
      };

      // Try to attach an artistId for collaborator if present in DB (non-blocking)
      try {
        const q = 'SELECT id, name FROM artists WHERE LOWER(name) = LOWER($1)';
        const r = await client.query(q, [person.name]);
        if (r.rows.length > 0) {
          collabNode.artistId = String(r.rows[0].id);
          collabNode.name = r.rows[0].name; // use canonical name
        }
      } catch {
        // ignore
      }

      if (!nodeMap.has(collabNode.name)) nodeMap.set(collabNode.name, collabNode);
      // Only first-degree link for skeleton
      const exists = links.find(l => l.source === mainNode.name && l.target === collabNode.name);
      if (!exists) links.push({ source: mainNode.name, target: collabNode.name });
    }

    const nodes = Array.from(nodeMap.values());
    await client.end();
    return res.json({ nodes, links, _metadata: { skeleton: true } });
  } catch (error) {
    console.error('❌ [skeleton] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


