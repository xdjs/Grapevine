import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../network/[artistName]';

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

const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

vi.doMock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}));

describe('GET /api/network/:artistName default skeleton behavior', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONNECTION_STRING = 'postgres://test';
    process.env.OPENAI_API_KEY = 'test-key';

    req = {
      method: 'GET',
      query: { artistName: 'Taylor Swift' },
      headers: {},
    } as any;

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

  it('returns skeleton (no roles/images) by default when cache is missing', async () => {
    mockClient.query
      // find artist
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
      // cache lookup -> no cache
      .mockResolvedValueOnce({ rows: [{ webmapdata: null }] })
      // cache update of skeleton
      .mockResolvedValueOnce({ rows: [] });

    // OpenAI collaborator list
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              collaborators: [
                { name: 'Jack Antonoff', roles: ['producer','songwriter'], topCollaborators: ['Lorde'] },
                { name: 'Max Martin', roles: ['producer'], topCollaborators: ['The Weeknd'] },
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
          expect.objectContaining({ name: 'Taylor Swift', size: 30 }),
          expect.objectContaining({ name: 'Jack Antonoff', size: 20 }),
          expect.objectContaining({ name: 'Max Martin', size: 20 }),
        ]),
        metadata: expect.objectContaining({ rolesIncluded: false, imagesIncluded: false }),
      })
    );

    const payload = (res.json as any).mock.calls[0][0];
    const collab = payload.nodes.find((n: any) => n.name === 'Jack Antonoff');
    expect(collab.type).toBeUndefined();
    expect(collab.types).toBeUndefined();
  });
});


