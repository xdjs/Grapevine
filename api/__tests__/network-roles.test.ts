import 'dotenv/config';
import handler from '../network-roles';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('openai');
const mockOpenAI = { chat: { completions: { create: vi.fn() } } };
vi.doMock('openai', () => ({ default: vi.fn(() => mockOpenAI) }));

describe('/api/network-roles', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'key';
    req = { method: 'POST', body: { names: ['Taylor Swift', 'Jack Antonoff'] }, headers: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis() };
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ 'Taylor Swift': ['artist', 'songwriter'], 'Jack Antonoff': ['producer'] }) } }]
    });
  });

  afterEach(() => { delete process.env.OPENAI_API_KEY; });

  it('returns roles map for provided names', async () => {
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ roles: expect.objectContaining({ 'Taylor Swift': expect.any(Array), 'Jack Antonoff': expect.any(Array) }) })
    );
  });
});


