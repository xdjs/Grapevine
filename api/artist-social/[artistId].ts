import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { artistId } = req.query;

  if (!artistId || typeof artistId !== 'string') {
    return res.status(400).json({ message: 'Artist ID is required' });
  }

  const CONNECTION_STRING = process.env.CONNECTION_STRING;
  if (!CONNECTION_STRING) {
    return res.status(500).json({ message: 'Database connection not configured' });
  }

  try {
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();

    // Query for the artist's X username from the 'x' column
    const query = 'SELECT id, name, x FROM artists WHERE id = $1';
    const result = await client.query(query, [artistId]);

    await client.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const artist = result.rows[0];
    
    return res.json({
      id: artist.id,
      name: artist.name,
      xUsername: artist.x || null
    });

  } catch (error) {
    console.error('Error fetching artist social data:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 