import 'dotenv/config';
import handler from '../network-by-id/[artistId]';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('pg');
vi.mock('openai');

const mockClient = { connect: vi.fn(), query: vi.fn(), end: vi.fn() } as any;
vi.doMock('pg', () => ({ Client: vi.fn(() => mockClient) }));

const mockOpenAI = { chat: { completions: { create: vi.fn() } } } as any;
vi.doMock('openai', () => ({ default: vi.fn(() => mockOpenAI) }));

describe('/api/network-by-id/:artistId timeouts', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECTION_STRING = 'postgres://test';
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.ROLE_DETECTION_ENABLED;

    req = { method: 'GET', query: { artistId: '1' } } as any;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as any;

    mockClient.connect.mockResolvedValue(undefined);
    mockClient.end.mockResolvedValue(undefined);

    // DB get artist
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
      // no cache
      .mockResolvedValueOnce({ rows: [{ webmapdata: null }] })
      // cache write later
      .mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    delete process.env.CONNECTION_STRING;
    delete process.env.OPENAI_API_KEY;
  });

  it('uses OpenAI timeout and still returns a response', async () => {
    // Hang OpenAI primary generation
    mockOpenAI.chat.completions.create.mockImplementation(() => new Promise(() => {}));

    const originalSetTimeout = global.setTimeout;
    (global as any).setTimeout = (fn: any) => { fn(); return 0 as any; };
    await handler(req as VercelRequest, res as VercelResponse);
    (global as any).setTimeout = originalSetTimeout;

    // On timeout, handler should catch and respond 500 or 503; we at least expect a JSON call
    expect(res.json).toHaveBeenCalled();
  });
});


