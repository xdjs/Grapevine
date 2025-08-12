import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type Role = 'artist' | 'producer' | 'songwriter';

interface RolesRequestBody {
  names: string[];
}

interface RolesResponseBody {
  roles: Record<string, Role[]>;
  unresolved?: string[];
  errors?: Array<{ name?: string; message: string }>;
  requestId?: string;
  elapsedMs?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed. Use POST.' });
    return;
  }

  const startTime = Date.now();
  const requestId = `${startTime}-${Math.random().toString(36).slice(2)}`;

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ message: 'OpenAI API key not configured' });
    }

    const body = (req.body || {}) as RolesRequestBody;
    const namesRaw = Array.isArray(body.names) ? body.names : [];
    const names = [...new Set(namesRaw.map(n => (typeof n === 'string' ? n.trim() : '').slice(0, 200)).filter(Boolean))];

    if (names.length === 0) {
      return res.status(400).json({ message: 'names array is required and must not be empty' });
    }
    if (names.length > 100) {
      return res.status(400).json({ message: 'Maximum 100 names per request' });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const namesList = names.map(n => `"${n.replace(/"/g, '\"')}"`).join(', ');
    const prompt = `For each of these music industry professionals: ${namesList}

Return their roles as JSON in this exact format (object mapping):
{
  "Person Name 1": ["artist", "songwriter"],
  "Person Name 2": ["producer"],
  "Person Name 3": ["artist", "producer", "songwriter"]
}

Rules:
- Roles must be from: ["artist", "producer", "songwriter"].
- Include ALL roles each person has.
- Return ONLY the JSON object, no extra text.`;

    // Hard timeout to avoid long hangs
    const timeoutMs = 6000;
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), timeoutMs));
    const response = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a precise music industry data assistant. Output strict JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 700,
      }) as Promise<any>,
      timeoutPromise,
    ]);

    const content = response.choices[0]?.message?.content?.trim() || '';
    let jsonContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    const jsonStart = jsonContent.indexOf('{');
    const jsonEnd = jsonContent.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
    }

    let parsed: Record<string, any> = {};
    try {
      parsed = JSON.parse(jsonContent) || {};
    } catch {
      parsed = {};
    }

    const allowed: Role[] = ['artist', 'producer', 'songwriter'];
    const roles: Record<string, Role[]> = {};
    const unresolved: string[] = [];

    for (const name of names) {
      const value = parsed[name];
      if (Array.isArray(value)) {
        const filtered = value.filter((r: string) => allowed.includes(r as Role));
        if (filtered.length > 0) {
          roles[name] = Array.from(new Set(filtered));
          continue;
        }
      }
      unresolved.push(name);
    }

    const elapsedMs = Date.now() - startTime;
    const responseBody: RolesResponseBody = { roles, requestId, elapsedMs };
    if (unresolved.length > 0) responseBody.unresolved = unresolved;
    res.json(responseBody);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}


