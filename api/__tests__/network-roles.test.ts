import handler from '../network-roles/index';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"A": ["artist"], "B": ["producer", "songwriter"], "C": ["other"]}' } }]
          })
        }
      }
    }))
  };
});

describe('/api/network-roles', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse> & { body?: any, statusCode?: number };

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    req = { method: 'POST', body: { names: ['A', 'B', 'C'] } } as any;
    res = {
      status(code: number) { this.statusCode = code; return this as any; },
      json(payload: any) { this.body = payload; return this as any; },
      setHeader: vi.fn(),
      end: vi.fn()
    } as any;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('returns roles map filtered to allowed roles', async () => {
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.body).toEqual({ roles: { A: ['artist'], B: ['producer', 'songwriter'] } });
  });

  it('validates method', async () => {
    req.method = 'GET';
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.statusCode).toBe(405);
  });

  it('validates input', async () => {
    req.body = {} as any;
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.statusCode).toBe(400);
  });

  it('handles missing API key', async () => {
    delete process.env.OPENAI_API_KEY;
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.statusCode).toBe(500);
  });
});


