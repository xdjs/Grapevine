import handler from '../network-skeleton-by-id/[artistId]';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockClient = {
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn()
};

vi.mock('pg', () => ({
  Client: vi.fn(() => mockClient)
}));

describe('/api/network-skeleton-by-id/[artistId]', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse> & { statusCode?: number; body?: any };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECTION_STRING = 'postgres://test';

    req = { method: 'GET', query: { artistId: '1' } } as any;
    res = {
      status(code: number) { this.statusCode = code; return this as any; },
      json(payload: any) { this.body = payload; return this as any; },
      setHeader: vi.fn(),
      end: vi.fn()
    } as any;
  });

  afterEach(() => {
    delete process.env.CONNECTION_STRING;
  });

  it('returns first-degree skeleton from cached webmapdata', async () => {
    const cached = {
      nodes: [
        { id: 'Main', name: 'Main', size: 30 },
        { id: 'A', name: 'A', size: 20 },
        { id: 'B', name: 'B', size: 20 },
        { id: 'C', name: 'C', size: 16 },
      ],
      links: [
        { source: 'Main', target: 'A' },
        { source: 'Main', target: 'B' },
        { source: 'A', target: 'C' }, // second-degree, should be excluded
      ]
    };

    mockClient.query.mockResolvedValueOnce({ rows: [{ name: 'Main', webmapdata: cached }] });

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.body.nodes.map((n: any) => n.id).sort()).toEqual(['A', 'B', 'Main']);
    expect(res.body.links).toEqual([
      { source: 'Main', target: 'A' },
      { source: 'Main', target: 'B' }
    ]);
  });

  it('falls back to single-node when no cache', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ name: 'Main', webmapdata: null }] });

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.body.nodes).toHaveLength(1);
    expect(res.body.nodes[0]).toMatchObject({ name: 'Main', size: 30 });
    expect(res.body.links).toHaveLength(0);
  });

  it('404 when artist not found', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.statusCode).toBe(404);
  });
});


