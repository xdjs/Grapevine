import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NetworkNode { id: string; name: string; size: number; type?: string; types?: string[]; artistId?: string | null }
interface NetworkLink { source: string; target: string }
interface NetworkData { nodes: NetworkNode[]; links: NetworkLink[] }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ message: 'Method not allowed' }); return; }

  try {
    const { artistName } = req.query as { artistName?: string };
    if (!artistName || typeof artistName !== 'string') { res.status(400).json({ message: 'artistName is required' }); return; }

    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    if (!CONNECTION_STRING) { res.status(500).json({ message: 'Database connection not configured' }); return; }

    const { Client } = await import('pg');
    const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // Find matching artist and cached network
    const findArtist = await client.query('SELECT id, name, webmapdata FROM artists WHERE LOWER(name) = LOWER($1) LIMIT 1', [artistName]);
    if (findArtist.rows.length === 0) {
      await client.end();
      res.status(404).json({ message: `Artist "${artistName}" not found` });
      return;
    }

    const id: string = String(findArtist.rows[0].id);
    const name: string = findArtist.rows[0].name;
    const cached: NetworkData | null = findArtist.rows[0].webmapdata ?? null;

    let skeleton: NetworkData | null = null;
    if (cached && cached.nodes && cached.links) {
      const main = cached.nodes.find(n => n.name === name) || cached.nodes.find(n => n.size === 30);
      if (main) {
        const mainId = main.id;
        const firstLinks = cached.links.filter(l => l.source === mainId || l.target === mainId);
        const neighborIds = new Set<string>();
        firstLinks.forEach(l => { neighborIds.add(l.source === mainId ? l.target : l.source); });
        const nodeSet = new Set<string>([mainId, ...neighborIds]);
        skeleton = {
          nodes: cached.nodes.filter(n => nodeSet.has(n.id)),
          links: firstLinks,
        };
      }
    }

    if (!skeleton) {
      // Fallback: only the main artist node
      skeleton = { nodes: [{ id: name, name, size: 30, artistId: id }], links: [] };
    } else {
      // Ensure main has artistId for client routing when available
      const main = skeleton.nodes.find(n => n.name === name) || skeleton.nodes.find(n => n.size === 30);
      if (main) main.artistId = id;
    }

    await client.end();
    res.json(skeleton);
  } catch (error) {
    console.error('❌ [Skeleton] Error:', error);
    res.status(500).json({ message: 'Failed to build skeleton', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}


