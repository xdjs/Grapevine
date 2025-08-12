import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type RolesResponse = {
  roles: Record<string, string[]>;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  try {
    const body = (req.body || {}) as { names?: string[] };
    const names = Array.isArray(body.names) ? body.names.filter(Boolean) : [];

    if (names.length === 0) {
      res.status(400).json({ message: 'names array is required' });
      return;
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      res.status(500).json({ message: 'OpenAI API key not configured' });
      return;
    }

    // Build prompt for batch role detection
    const peopleListStr = names.map(n => `"${n}"`).join(', ');
    const prompt = `For each of these music industry professionals: ${peopleListStr}

Return their roles as JSON in this exact format:
{
  "Person Name 1": ["artist", "songwriter"],
  "Person Name 2": ["producer", "songwriter"],
  "Person Name 3": ["artist"]
}

Each person's roles should be from: ["artist", "producer", "songwriter"]. Include ALL roles each person has. Return ONLY the JSON object, no other text.`;

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '';
    let parsed: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback to empty
      parsed = {};
    }

    const roles: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        const filtered = value.filter(v => ['artist', 'producer', 'songwriter'].includes(String(v)));
        if (filtered.length > 0) roles[key] = filtered as string[];
      }
    }

    const response: RolesResponse = { roles };
    res.json(response);
  } catch (error) {
    console.error('❌ [Roles] Error:', error);
    res.status(500).json({ message: 'Failed to detect roles', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}


