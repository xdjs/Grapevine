import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SkeletonNode {
  id: string;
  name: string;
  size: number;
  artistId: string | null;
  imageUrl?: string | null; // may exist on cached data
  spotifyId?: string | null; // may exist on cached data
  // intentionally omit role fields for skeleton generation
}

interface SkeletonLink {
  source: string;
  target: string;
}

interface SkeletonResponse {
  nodes: SkeletonNode[];
  links: SkeletonLink[];
  cached: boolean;
  metadata: {
    rolesIncluded: boolean;
    imagesIncluded: boolean;
  };
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
    const query = 'SELECT id, name, webmapdata FROM artists WHERE LOWER(name) = LOWER($1)';
    const result = await client.query(query, [variation]);
    if (result.rows.length > 0) {
      return { id: result.rows[0].id.toString(), name: result.rows[0].name };
    }
  }
  return null;
}

function inferRolesIncluded(nodes: any[] | undefined): boolean {
  if (!nodes || nodes.length === 0) return false;
  return nodes.some((n) => Array.isArray(n?.types) && n.types.length > 0) || nodes.some((n) => typeof n?.type === 'string');
}

function inferImagesIncluded(nodes: any[] | undefined): boolean {
  if (!nodes || nodes.length === 0) return false;
  return nodes.some((n) => !!n?.imageUrl);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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
    const allowHallucinations = req.query.allowHallucinations === 'true';

    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!CONNECTION_STRING) {
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    const { Client } = await import('pg');
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    // Verify artist exists and get canonical name
    const artistMatch = await findArtistInDatabase(client, artistName);
    if (!artistMatch) {
      await client.end();
      return res.status(404).json({ message: `Artist "${artistName}" not found in database. Please search for an existing artist.` });
    }
    const correctArtistName = artistMatch.name;

    // Try cache first
    try {
      const cachedQuery = 'SELECT webmapdata FROM artists WHERE LOWER(name) = LOWER($1)';
      const cachedResult = await client.query(cachedQuery, [correctArtistName]);
      const cached = cachedResult.rows?.[0]?.webmapdata || null;
      if (cached && cached.nodes && Array.isArray(cached.nodes)) {
        const rolesIncluded = inferRolesIncluded(cached.nodes);
        const imagesIncluded = inferImagesIncluded(cached.nodes);

        // If single-node cached and no hallucinations allowed, return special structure
        if (!allowHallucinations && cached.nodes.length <= 1) {
          const singleNode = {
            id: correctArtistName,
            name: correctArtistName,
            size: 30,
            artistId: artistMatch.id,
          } as SkeletonNode;
          await client.end();
          return res.json({
            noCollaborators: true,
            artistName: correctArtistName,
            artistId: artistMatch.id,
            singleNodeNetwork: { nodes: [singleNode], links: [] },
          });
        }

        const response: SkeletonResponse = {
          nodes: cached.nodes,
          links: cached.links || [],
          cached: true,
          metadata: { rolesIncluded, imagesIncluded },
        };
        await client.end();
        return res.json(response);
      }
    } catch (cacheErr) {
      // Ignore cache errors and proceed to generation
    }

    // Cache miss path
    if (!OPENAI_API_KEY) {
      await client.end();
      return res.status(503).json({
        error: 'OpenAI API key not configured',
        message: 'Skeleton network generation requires OPENAI_API_KEY',
        artist: artistName,
        timestamp: new Date().toISOString(),
      });
    }

    // Build base nodes/links with NO roles
    const mainNode: SkeletonNode = {
      id: correctArtistName,
      name: correctArtistName,
      size: 30,
      artistId: artistMatch.id,
    };

    const nodes: SkeletonNode[] = [mainNode];
    const links: SkeletonLink[] = [];

    // Generate collaborators (ignore roles)
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const prompt = `Provide up to 10 authentic collaborators for ${correctArtistName} in JSON. Omit any roles entirely. Include top collaborators for each person. Format:
{
  "collaborators": [
    { "name": "Person Name", "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"] }
  ]
}
Rules:
- Only real, well-documented collaborators for mainstream artists; be selective but accurate for lesser-known artists.
- If none exist, return {"collaborators": []}.
- Return ONLY JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a music industry database expert. Provide accurate, verified collaborations.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    let collaborators: Array<{ name: string; topCollaborators?: string[] }> = [];
    try {
      let content = completion.choices[0]?.message?.content?.trim() || '';
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) content = content.substring(start, end + 1);
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed?.collaborators)) {
        collaborators = parsed.collaborators.map((c: any) => ({ name: c.name, topCollaborators: c.topCollaborators || [] }));
      }
    } catch {
      // fall through; treat as no collaborators
      collaborators = [];
    }

    if (!allowHallucinations && collaborators.length === 0) {
      const singleNodeNetwork = { nodes: [mainNode], links: [] };
      await client.end();
      return res.json({
        noCollaborators: true,
        artistName: correctArtistName,
        artistId: artistMatch.id,
        singleNodeNetwork,
      });
    }

    // Build direct collaborator nodes and links (no branching, no roles)
    for (const person of collaborators) {
      if (!person?.name || typeof person.name !== 'string') continue;
      const collabNode: SkeletonNode = {
        id: person.name,
        name: person.name,
        size: 20,
        artistId: null,
      };
      // Avoid duplicates
      if (!nodes.find((n) => n.id === collabNode.id)) nodes.push(collabNode);
      // Link from main artist to collaborator (once)
      if (!links.find((l) => l.source === correctArtistName && l.target === person.name)) {
        links.push({ source: correctArtistName, target: person.name });
      }
    }

    const networkData = { nodes, links };

    // Cache minimal skeleton (best-effort)
    try {
      const updateQuery = 'UPDATE artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2)';
      await client.query(updateQuery, [JSON.stringify(networkData), correctArtistName]);
    } catch {
      // non-fatal
    }

    await client.end();

    const response: SkeletonResponse = {
      nodes,
      links,
      cached: false,
      metadata: { rolesIncluded: false, imagesIncluded: false },
    };
    return res.json(response);
  } catch (error) {
    console.error('❌ [Skeleton] Error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}


