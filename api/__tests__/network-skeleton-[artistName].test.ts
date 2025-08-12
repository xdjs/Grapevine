import handler from '../network-skeleton/[artistName]';
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

describe('/api/network-skeleton/[artistName]', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse> & { statusCode?: number; body?: any };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECTION_STRING = 'postgres://test';
    req = { method: 'GET', query: { artistName: 'Main' } } as any;
    res = {
      status(code: number) { this.statusCode = code; return this as any; },
      json(payload: any) { this.body = payload; return this as any; },
      setHeader: vi.fn(),
      end: vi.fn()
    } as any;
  });

  afterEach(() => { delete process.env.CONNECTION_STRING; });

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
        { source: 'A', target: 'C' },
      ]
    };

    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Main', webmapdata: cached }] });

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.body.nodes.map((n: any) => n.id).sort()).toEqual(['A', 'B', 'Main']);
    expect(res.body.links).toEqual([
      { source: 'Main', target: 'A' },
      { source: 'Main', target: 'B' }
    ]);
  });

  it('falls back to single-node when artist not cached', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Main', webmapdata: null }] });

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.body.nodes).toHaveLength(1);
    expect(res.body.nodes[0]).toMatchObject({ name: 'Main', size: 30 });
  });

  it('404 for missing artist', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.statusCode).toBe(404);
  });
});


