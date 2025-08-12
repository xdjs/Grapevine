import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../network-skeleton/[artistName]';

// Mocks
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

describe('/api/network-skeleton/:artistName', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.CONNECTION_STRING = 'postgresql://test';
    process.env.OPENAI_API_KEY = 'test-openai-key';

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

  it('returns cached network with inferred metadata (roles/images) on cache hit', async () => {
    // DB lookup for artist (findArtistInDatabase)
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift', webmapdata: null }] })
      // cached webmapdata fetch
      .mockResolvedValueOnce({
        rows: [
          {
            webmapdata: {
              nodes: [
                { id: 'Taylor Swift', name: 'Taylor Swift', type: 'artist', types: ['artist'], imageUrl: 'x', size: 30, artistId: '1' },
                { id: 'Jack Antonoff', name: 'Jack Antonoff', types: ['producer', 'songwriter'], size: 20, artistId: null },
              ],
              links: [{ source: 'Taylor Swift', target: 'Jack Antonoff' }],
            },
          },
        ],
      });

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        cached: true,
        nodes: expect.any(Array),
        links: expect.any(Array),
        metadata: expect.objectContaining({ rolesIncluded: true, imagesIncluded: true }),
      })
    );
  });

  it('generates skeleton (no roles) on cache miss and returns cached=false', async () => {
    mockClient.query
      // find artist
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
      // cached webmapdata -> null
      .mockResolvedValueOnce({ rows: [{ webmapdata: null }] })
      // update cache
      .mockResolvedValueOnce({ rows: [] });

    // OpenAI returns collaborators without roles (we ignore roles anyway)
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              collaborators: [
                { name: 'Jack Antonoff', topCollaborators: ['Lorde', 'Bleachers'] },
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
        cached: false,
        nodes: expect.arrayContaining([
          expect.objectContaining({ name: 'Taylor Swift', size: 30 }),
          expect.objectContaining({ name: 'Jack Antonoff', size: 20 }),
          expect.objectContaining({ name: 'Max Martin', size: 20 }),
        ]),
        metadata: expect.objectContaining({ rolesIncluded: false, imagesIncluded: false }),
      })
    );

    const callArg = (res.json as any).mock.calls[0][0];
    const aNode = callArg.nodes.find((n: any) => n.name === 'Jack Antonoff');
    expect(aNode.type).toBeUndefined();
    expect(aNode.types).toBeUndefined();
  });

  it('returns single-node structure when no collaborators and hallucinations are not allowed', async () => {
    mockClient.query
      // find artist
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Taylor Swift' }] })
      // cached webmapdata -> null
      .mockResolvedValueOnce({ rows: [{ webmapdata: null }] });

    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ collaborators: [] }),
          },
        },
      ],
    });

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        noCollaborators: true,
        artistName: 'Taylor Swift',
        singleNodeNetwork: expect.objectContaining({ nodes: expect.any(Array), links: [] }),
      })
    );
  });
});


