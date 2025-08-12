// Replace file content with a fast, cache-first skeleton (no OpenA
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NetworkNode { id: string; name: string; size: number; artistId?: string | null }
interface NetworkLink { source: string; target: string }
interface NetworkData { nodes: NetworkNode[]; links: NetworkLink[] }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ message: 'Method not allowed' }); return; }

  try {
    const { artistId } = req.query as { artistId?: string };
    if (!artistId) { res.status(400).json({ message: 'artistId is required' }); return; }

    const CONNECTION_STRING = process.env.CONNECTION_STRING;
    if (!CONNECTION_STRING) { res.status(500).json({ message: 'Database connection not configured' }); return; }

    const { Client } = await import('pg');
    const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const result = await client.query('SELECT name, webmapdata FROM artists WHERE id = $1 LIMIT 1', [artistId]);
    if (result.rows.length === 0) { await client.end(); res.status(404).json({ message: 'Artist not found' }); return; }
    const name: string = result.rows[0].name;
    const cached: NetworkData | null = result.rows[0].webmapdata ?? null;

    let skeleton: NetworkData;
    if (cached && cached.nodes && cached.links) {
      const main = cached.nodes.find((n: any) => n.name === name) || cached.nodes.find((n: any) => n.size === 30);
      if (main) {
        const mainId = main.id;
        const firstLinks = cached.links.filter((l: any) => l.source === mainId || l.target === mainId);
        const neighborIds = new Set<string>();
        firstLinks.forEach((l: any) => { neighborIds.add(l.source === mainId ? l.target : l.source); });
        const nodeSet = new Set<string>([mainId, ...neighborIds]);
        skeleton = { nodes: cached.nodes.filter((n: any) => nodeSet.has(n.id)), links: firstLinks } as NetworkData;
      } else {
        skeleton = { nodes: [{ id: name, name, size: 30, artistId }], links: [] };
      }
    } else {
      skeleton = { nodes: [{ id: name, name, size: 30, artistId }], links: [] };
    }

    await client.end();
    res.json(skeleton);
  } catch (error) {
    res.status(500).json({ message: 'Failed to build skeleton', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
