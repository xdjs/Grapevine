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
  collaborators?: Array<{ name: string; topCollaborators: string[] }>; // new shape
  artists?: Array<{ name: string; topCollaborators: string[] }>; // legacy shape
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ message: 'Method not allowed' }); return; }

  const startTime = Date.now();
  const requestId = `${startTime}-${Math.random().toString(36).slice(2)}`;

  try {
    const { artistId } = req.query;
    const allowHallucinations = req.query.allowHallucinations === 'true';
    if (!artistId || typeof artistId !== 'string') {
      return res.status(400).json({ message: 'Artist ID is required' });
    }

    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!CONNECTION_STRING) {
      return res.status(500).json({ message: 'Database connection not configured' });
    }

    const { Client } = await import('pg');
    const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
    await client.connect();

    try {
      // Lookup artist by ID
      const artistQuery = 'SELECT id, name, webmapdata FROM artists WHERE id = $1';
      const artistResult = await client.query(artistQuery, [artistId]);
      if (artistResult.rows.length === 0) {
        await client.end();
        return res.status(404).json({ message: `Artist with ID "${artistId}" not found in database.` });
      }
      const artist = artistResult.rows[0];

      // Cache hit
      if (artist.webmapdata) {
        const cachedData = artist.webmapdata;
        const isSingleNode = cachedData.nodes && cachedData.nodes.length === 1 && (!cachedData.links || cachedData.links.length === 0);
        if (isSingleNode && !allowHallucinations) {
          await client.end();
          return res.json({ noCollaborators: true, artistName: artist.name, artistId: artist.id, singleNodeNetwork: cachedData });
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

      // No cache: generate skeleton via OpenAI
      if (!OPENAI_API_KEY) {
        await client.end();
        return res.status(503).json({ error: 'OpenAI API key not configured', message: 'Network generation requires OpenAI API key.', artistId, timestamp: new Date().toISOString() });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      const prompt = `Provide a concise list of music industry professionals who have collaborated with ${artist.name}.

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
        const timeoutMs = 8000;
        const completion = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: 'You are a precise music industry data assistant. Output strict JSON.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 700,
          }) as Promise<any>,
          new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), timeoutMs)),
        ]);

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
            collaborationData = { collaborators: parsed.collaborators.map((c: any) => ({ name: String(c.name), topCollaborators: Array.isArray(c.topCollaborators) ? c.topCollaborators.slice(0, 3).map(String) : [], })) };
          }
        } catch {
          // keep empty collaborators
        }
      } catch {
        const elapsedMs = Date.now() - startTime;
        await client.end();
        const mainNode: NetworkNodeSkeleton = { id: artist.name, name: artist.name, size: 30, artistId: artist.id };
        return res.json({ nodes: [mainNode], links: [], cached: false, metadata: { rolesIncluded: false, imagesIncluded: false, partial: true, source: 'openai-error', elapsedMs, requestId } });
      }

      const nodeMap = new Map<string, NetworkNodeSkeleton>();
      const links: NetworkLink[] = [];
      const mainNode: NetworkNodeSkeleton = { id: artist.name, name: artist.name, size: 30, artistId: artist.id };
      nodeMap.set(artist.name, mainNode);

      const collaborators = collaborationData.collaborators || collaborationData.artists || [];
      for (const person of collaborators) {
        if (!person?.name || typeof person.name !== 'string') continue;
        const name = person.name;
        if (!nodeMap.has(name)) nodeMap.set(name, { id: name, name, size: 20, artistId: null });
        if (!links.find(l => l.source === artist.name && l.target === name)) links.push({ source: artist.name, target: name });
        for (const branching of person.topCollaborators || []) {
          if (branching && typeof branching === 'string' && branching !== artist.name) {
            if (!nodeMap.has(branching)) nodeMap.set(branching, { id: branching, name: branching, size: 16, artistId: null });
            if (!links.find(l => l.source === name && l.target === branching)) links.push({ source: name, target: branching });
          }
        }
      }

      const nodes = Array.from(nodeMap.values());
      const networkData = { nodes, links };

      try {
        await client.query('UPDATE artists SET webmapdata = $1 WHERE id = $2', [JSON.stringify(networkData), artist.id]);
      } catch {}

      const elapsedMs = Date.now() - startTime;
      await client.end();
      return res.json({ ...networkData, cached: false, metadata: { rolesIncluded: false, imagesIncluded: false, partial: false, source: 'openai', elapsedMs, requestId } });
    } catch (e) {
      await client.end();
      throw e;
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
  }
}


