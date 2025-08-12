import 'dotenv/config';
import handler from '../network-skeleton/[artistName]';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('pg');
vi.mock('openai');

const mockClient = { connect: vi.fn(), query: vi.fn(), end: vi.fn() };
vi.doMock('pg', () => ({ Client: vi.fn(() => mockClient) }));

const mockOpenAI = { chat: { completions: { create: vi.fn() } } };
vi.doMock('openai', () => ({ default: vi.fn(() => mockOpenAI) }));

describe('/api/network-skeleton/[artistName]', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECTION_STRING = 'postgres://test';
    process.env.OPENAI_API_KEY = 'key';

    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] }) // findArtistInDatabase
      .mockResolvedValue({ rows: [] });

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ collaborators: [{ name: 'Jack Antonoff', roles: ['producer'] }] }) } }]
    });

    req = { method: 'GET', query: { artistName: 'Taylor Swift' }, headers: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis() };
  });

  afterEach(() => {
    delete process.env.CONNECTION_STRING;
    delete process.env.OPENAI_API_KEY;
  });

  it('returns skeleton nodes and links quickly', async () => {
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ name: 'Taylor Swift', size: 30 }),
          expect.objectContaining({ name: 'Jack Antonoff', size: 20 })
        ]),
        links: expect.arrayContaining([
          expect.objectContaining({ source: 'Taylor Swift', target: expect.any(String) })
        ]),
        _metadata: expect.objectContaining({ skeleton: true })
      })
    );
  });
});


