import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Try multiple possible locations for the favicon
    const possiblePaths = [
      path.join(process.cwd(), 'client', 'public', 'favicon.ico'),
      path.join(process.cwd(), 'public', 'favicon.ico'),
      path.join(process.cwd(), 'favicon.ico'),
      path.join(process.cwd(), 'api', 'favicon.ico'),
    ];

    let faviconPath = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        faviconPath = possiblePath;
        break;
      }
    }

    if (!faviconPath) {
      return res.status(404).json({ error: 'Favicon not found' });
    }

    const favicon = fs.readFileSync(faviconPath);
    
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    return res.send(favicon);
  } catch (error) {
    console.error('Error serving favicon:', error);
    return res.status(500).json({ error: 'Error serving favicon' });
  }
}