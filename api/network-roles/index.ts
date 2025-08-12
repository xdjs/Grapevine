import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const body = req.body || {};
    const names: string[] = Array.isArray(body.names) ? body.names : Array.isArray(body.people) ? body.people : [];
    if (!names.length) {
      return res.status(400).json({ message: 'names array is required' });
    }

    // Deduplicate and cap to reasonable batch size
    const unique = Array.from(new Set(names)).slice(0, 100);

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const list = unique.map(n => `"${n}"`).join(', ');
    const prompt = `For each of these people: ${list}\nReturn ONLY JSON mapping names to roles from ["artist","producer","songwriter"].\nExample: {"Name": ["artist","songwriter"]}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1200,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '';
    let jsonText = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) jsonText = jsonText.substring(start, end + 1);

    let rolesMap: Record<string, string[]> = {};
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) {
          const valid = v.filter(r => ['artist', 'producer', 'songwriter'].includes(String(r)));
          if (valid.length) rolesMap[k] = Array.from(new Set(valid));
        }
      }
    } catch {
      rolesMap = {};
    }

    // Constrain unknowns to default role guesses client-side; server returns what it knows
    return res.json({ roles: rolesMap, requested: unique.length });
  } catch (error) {
    console.error('❌ [roles] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


