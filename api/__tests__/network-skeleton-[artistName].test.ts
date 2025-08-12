import 'dotenv/config';
import handler from '../network-skeleton/[artistName]';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('pg');
vi.mock('openai');

const mockClient = {
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
};

vi.doMock('pg', () => ({
  Client: vi.fn(() => mockClient),
}));

const mockOpenAI = { chat: { completions: { create: vi.fn() } } } as any;
vi.doMock('openai', () => ({ default: vi.fn(() => mockOpenAI) }));

describe('/api/network-skeleton/:artistName', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECTION_STRING = 'postgres://test';
    process.env.OPENAI_API_KEY = 'test-key';

    req = { method: 'GET', query: { artistName: 'Taylor Swift' } } as any;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as any;

    mockClient.connect.mockResolvedValue(undefined);
    mockClient.end.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.CONNECTION_STRING;
    delete process.env.OPENAI_API_KEY;
  });

  it('returns 404 when artist not found', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns cached data when available', async () => {
    // findArtistInDatabase
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
      // cache lookup -> multi-node to avoid single-node special-case
      .mockResolvedValueOnce({ rows: [{ webmapdata: { nodes: [{ id: 'Taylor Swift', name: 'Taylor Swift' }, { id: 'Jack Antonoff', name: 'Jack Antonoff' }], links: [{ source: 'Taylor Swift', target: 'Jack Antonoff' }] } }] });

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.any(Array),
        links: expect.any(Array),
        cached: true,
        metadata: expect.objectContaining({ source: 'cache' }),
      })
    );
  });

  it('returns single-node when OpenAI fails', async () => {
    // find
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
      // cache lookup (none)
      .mockResolvedValueOnce({ rows: [{ webmapdata: null }] });

    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI down'));

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ name: 'Taylor Swift' })]),
        links: [],
        metadata: expect.objectContaining({ partial: true, source: 'openai-error' }),
      })
    );
  });

  it('generates skeleton without roles and caches it', async () => {
    // find
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
      // cache lookup (none)
      .mockResolvedValueOnce({ rows: [{ webmapdata: null }] })
      // update cache
      .mockResolvedValueOnce({ rows: [] });

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              collaborators: [
                { name: 'Jack Antonoff', topCollaborators: ['Lorde'] },
                { name: 'Max Martin', topCollaborators: ['The Weeknd'] },
              ],
            }),
          },
        },
      ],
    });

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ name: 'Taylor Swift' }),
          expect.objectContaining({ name: 'Jack Antonoff' }),
          expect.objectContaining({ name: 'Max Martin' }),
        ]),
        cached: false,
        metadata: expect.objectContaining({ rolesIncluded: false, imagesIncluded: false }),
      })
    );

    // ensure UPDATE was called to cache
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2)',
      [expect.any(String), 'Taylor Swift']
    );
  });

  it('times out OpenAI and returns single-node fallback', async () => {
    // find
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
      // cache lookup (none)
      .mockResolvedValueOnce({ rows: [{ webmapdata: null }] });

    // Simulate a hanging OpenAI by returning a promise that never resolves within test timeframe
    mockOpenAI.chat.completions.create.mockImplementation(() => new Promise(() => {}));

    // Use real timers but set a generous test timeout
    const resultPromise = handler(req as VercelRequest, res as VercelResponse);
    // Advance fake timers is not used; rely on function's 8s timeout; shorten by mocking setTimeout
    const originalSetTimeout = global.setTimeout;
    (global as any).setTimeout = (fn: any) => { fn(); return 0 as any; };
    await resultPromise;
    (global as any).setTimeout = originalSetTimeout;

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ name: 'Taylor Swift' })]),
        links: [],
        metadata: expect.objectContaining({ partial: true, source: 'openai-error' }),
      })
    );
  });
});


