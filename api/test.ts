import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧪 [Vercel Test] Function started');
  console.log('🧪 [Vercel Test] Method:', req.method);
  console.log('🧪 [Vercel Test] URL:', req.url);
  console.log('🧪 [Vercel Test] Query:', req.query);
  console.log('🧪 [Vercel Test] Headers:', req.headers);
  console.log('🧪 [Vercel Test] Environment vars count:', Object.keys(process.env).length);
  console.log('🧪 [Vercel Test] Node version:', process.version);
  console.log('🧪 [Vercel Test] Timestamp:', new Date().toISOString());

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('🧪 [Vercel Test] CORS preflight request');
    res.status(200).end();
    return;
  }

  const response = {
    success: true,
    message: 'Vercel API function is working',
    timestamp: new Date().toISOString(),
    method: req.method,
    query: req.query,
    nodeVersion: process.version,
    envVarsCount: Object.keys(process.env).length,
    hasConnectionString: !!process.env.CONNECTION_STRING,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    musicNerdBaseUrl: process.env.MUSICNERD_BASE_URL || 'NOT_SET',
    allMusicNerdEnvs: {
      MUSICNERD_BASE_URL: process.env.MUSICNERD_BASE_URL,
      MUSICNERD_URL: process.env.MUSICNERD_URL,
      MUSIC_NERD_BASE_URL: process.env.MUSIC_NERD_BASE_URL,
      MUSIC_NERD_URL: process.env.MUSIC_NERD_URL
    }
  };

  console.log('🧪 [Vercel Test] Sending response:', JSON.stringify(response, null, 2));
  
  res.status(200).json(response);
}