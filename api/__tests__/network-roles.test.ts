import 'dotenv/config';
import handler from '../network-roles';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('openai');

const mockOpenAI = { chat: { completions: { create: vi.fn() } } } as any;
vi.doMock('openai', () => ({ default: vi.fn(() => mockOpenAI) }));

describe('/api/network-roles', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    req = { method: 'POST', body: { names: ['Taylor Swift', 'Jack Antonoff'] } } as any;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as any;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('validates input', async () => {
    req.body = { names: [] } as any;
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns roles mapping from OpenAI response', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              'Taylor Swift': ['artist', 'songwriter'],
              'Jack Antonoff': ['artist', 'producer', 'songwriter'],
            }),
          },
        },
      ],
    });

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: {
          'Taylor Swift': ['artist', 'songwriter'],
          'Jack Antonoff': ['artist', 'producer', 'songwriter'],
        },
      })
    );
  });

  it('filters invalid roles and marks unresolved', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              'Taylor Swift': ['artist', 'dancer'],
              'Jack Antonoff': 'not-an-array',
            }),
          },
        },
      ],
    });

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: { 'Taylor Swift': ['artist'] },
        unresolved: expect.arrayContaining(['Jack Antonoff']),
      })
    );
  });

  it('handles OpenAI parse failure gracefully', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'not-json' } }],
    });

    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ roles: {}, unresolved: expect.arrayContaining(['Taylor Swift', 'Jack Antonoff']) })
    );
  });

  it('handles OpenAI timeout gracefully with unresolved names', async () => {
    // Simulate hang
    mockOpenAI.chat.completions.create.mockImplementation(() => new Promise(() => {}));

    const originalSetTimeout = global.setTimeout;
    (global as any).setTimeout = (fn: any) => { fn(); return 0 as any; };
    await handler(req as VercelRequest, res as VercelResponse);
    (global as any).setTimeout = originalSetTimeout;

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: {},
        unresolved: expect.arrayContaining(['Taylor Swift', 'Jack Antonoff'])
      })
    );
  });
});


