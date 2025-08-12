import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NetworkNodeSkeleton {
  id: string;
  name: string;
  size: number;
  artistId: string | null;
  imageUrl?: string | null;
  spotifyId?: string | null;
}

interface NetworkLink {
  source: string;
  target: string;
}

interface CollaborationData {
  collaborators?: Array<{
    name: string;
    topCollaborators: string[];
  }>;
  artists?: Array<{
    name: string;
    topCollaborators: string[];
  }>;
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
      return {
        id: result.rows[0].id.toString(),
        name: result.rows[0].name,
      };
    }
  }
  return null;
}

function hasRolesIncluded(webmapdata: any): boolean {
  if (!webmapdata || !Array.isArray(webmapdata.nodes)) return false;
  return webmapdata.nodes.some((n: any) => Array.isArray(n?.types) && n.types.length > 0 || typeof n?.type === 'string');
}

function hasImagesIncluded(webmapdata: any): boolean {
  if (!webmapdata || !Array.isArray(webmapdata.nodes)) return false;
  return webmapdata.nodes.some((n: any) => typeof n?.imageUrl === 'string' && n.imageUrl.length > 0);
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
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const startTime = Date.now();
  const requestId = `${startTime}-${Math.random().toString(36).slice(2)}`;

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

    try {
      // Locate artist
      const artistMatch = await findArtistInDatabase(client, artistName);
      if (!artistMatch) {
        await client.end();
        return res.status(404).json({ message: `Artist "${artistName}" not found in database. Please search for an existing artist.` });
      }

      const correctArtistName = artistMatch.name;

      // Try cache first
      const cacheQuery = 'SELECT webmapdata FROM artists WHERE LOWER(name) = LOWER($1)';
      const cacheResult = await client.query(cacheQuery, [correctArtistName]);
      const cachedData = cacheResult.rows?.[0]?.webmapdata;

      if (cachedData) {
        // Determine single-node or multi-node
        const isSingleNode = Array.isArray(cachedData.nodes) && cachedData.nodes.length === 1 && (!cachedData.links || cachedData.links.length === 0);
        if (isSingleNode && !allowHallucinations) {
          await client.end();
          return res.json({
            noCollaborators: true,
            artistName: correctArtistName,
            artistId: artistMatch.id,
            singleNodeNetwork: cachedData,
          });
        }

        const elapsedMs = Date.now() - startTime;
        await client.end();
        return res.json({
          ...cachedData,
          cached: true,
          metadata: {
            rolesIncluded: hasRolesIncluded(cachedData),
            imagesIncluded: hasImagesIncluded(cachedData),
            partial: false,
            source: 'cache',
            elapsedMs,
            requestId,
          },
        });
      }

      // Cache miss → need OpenAI to generate skeleton
      if (!OPENAI_API_KEY) {
        await client.end();
        return res.status(503).json({
          error: 'OpenAI API key not configured',
          message: 'Network generation requires OpenAI API key. Please set OPENAI_API_KEY environment variable.',
          artist: artistName,
          timestamp: new Date().toISOString(),
        });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

      const prompt = `Provide a concise list of music industry professionals who have collaborated with ${correctArtistName}.

Return ONLY valid JSON in this exact format:
{
  "collaborators": [
    { "name": "Person Name", "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"] }
  ]
}

Rules:
- Do NOT include roles here (they will be fetched separately).
- For mainstream artists: include well-documented collaborators. For lesser-known artists: be selective but accurate.
- Max 10 collaborators.
- No placeholders or fake names.`;

      let collaborationData: CollaborationData = { collaborators: [] };

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a precise music industry data assistant. Output strict JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 1200,
        });

        const content = completion.choices[0]?.message?.content?.trim() || '';
        let jsonContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        const jsonStart = jsonContent.indexOf('{');
        const jsonEnd = jsonContent.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
        }
        try {
          const parsed = JSON.parse(jsonContent);
          if (parsed && Array.isArray(parsed.collaborators)) {
            collaborationData = { collaborators: parsed.collaborators.map((c: any) => ({
              name: String(c.name),
              topCollaborators: Array.isArray(c.topCollaborators) ? c.topCollaborators.slice(0, 3).map(String) : [],
            })) };
          }
        } catch {
          // keep empty collaborators on parse failure
        }
      } catch {
        // OpenAI error → degrade to single-node
        const mainNode: NetworkNodeSkeleton = {
          id: correctArtistName,
          name: correctArtistName,
          size: 30,
          artistId: artistMatch.id,
        };
        const elapsedMs = Date.now() - startTime;
        await client.end();
        return res.json({
          nodes: [mainNode],
          links: [],
          cached: false,
          metadata: {
            rolesIncluded: false,
            imagesIncluded: false,
            partial: true,
            source: 'openai-error',
            elapsedMs,
            requestId,
          },
        });
      }

      const nodeMap = new Map<string, NetworkNodeSkeleton>();
      const links: NetworkLink[] = [];

      // Main node
      const mainNode: NetworkNodeSkeleton = {
        id: correctArtistName,
        name: correctArtistName,
        size: 30,
        artistId: artistMatch.id,
      };
      nodeMap.set(correctArtistName, mainNode);

      const collaborators = collaborationData.collaborators || collaborationData.artists || [];

      // Create collaborator nodes without roles
      for (const person of collaborators) {
        if (!person?.name || typeof person.name !== 'string') continue;
        const name = person.name;
        if (!nodeMap.has(name)) {
          nodeMap.set(name, { id: name, name, size: 20, artistId: null });
        }
        // Link from main to collaborator
        if (!links.find(l => l.source === correctArtistName && l.target === name)) {
          links.push({ source: correctArtistName, target: name });
        }
        // Branching
        for (const branching of person.topCollaborators || []) {
          if (branching && typeof branching === 'string' && branching !== correctArtistName) {
            if (!nodeMap.has(branching)) {
              nodeMap.set(branching, { id: branching, name: branching, size: 16, artistId: null });
            }
            if (!links.find(l => l.source === name && l.target === branching)) {
              links.push({ source: name, target: branching });
            }
          }
        }
      }

      const nodes = Array.from(nodeMap.values());
      const networkData = { nodes, links };

      // Cache the skeleton to speed future loads
      try {
        const updateQuery = 'UPDATE artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2)';
        await client.query(updateQuery, [JSON.stringify(networkData), correctArtistName]);
      } catch {
        // non-fatal
      }

      const elapsedMs = Date.now() - startTime;
      await client.end();
      return res.json({
        ...networkData,
        cached: false,
        metadata: {
          rolesIncluded: false,
          imagesIncluded: false,
          partial: false,
          source: 'openai',
          elapsedMs,
          requestId,
        },
      });
    } catch (e) {
      await client.end();
      throw e;
    }
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}


