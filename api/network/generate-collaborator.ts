import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CollaboratorRequest {
  collaboratorName: string;
  collaboratorRoles: string[];
}

interface NetworkNode {
  id: string;
  name: string;
  type: string;
  types?: string[];
  size: number;
  artistId?: string | null;
  imageUrl?: string | null;
}

interface NetworkLink {
  source: string;
  target: string;
}

interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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
    // Extract request data
    const requestBody = req.body as CollaboratorRequest;
    const collaboratorName = requestBody.collaboratorName;
    const collaboratorRoles = requestBody.collaboratorRoles;
    
    if (!collaboratorName || !collaboratorRoles) {
      return res.status(400).json({ message: 'Collaborator name and roles are required' });
    }

    console.log(`🤖 [Generate-Collaborator] Generating network for: ${collaboratorName} with roles: [${collaboratorRoles.join(', ')}]`);
    
    // Check OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error(`❌ [Generate-Collaborator] OpenAI API key not configured`);
      return res.status(503).json({ 
        error: 'OpenAI API key not configured',
        message: 'Network generation requires OpenAI API key'
      });
    }

    // Import and initialize OpenAI
    const OpenAI = (await import('openai')).default;
    const openaiClient = new OpenAI({ apiKey });

    // Determine role description
    const roleDescription = collaboratorRoles.includes('artist') ? 'artist' : 
                           collaboratorRoles.includes('producer') ? 'producer' : 'songwriter';
    
    // Create prompt
    const promptText = `Generate a music industry collaboration network for ${collaboratorName}, who is known as a ${roleDescription}. 

Provide a list of artists, producers, and songwriters who have worked with ${collaboratorName}. Focus on real collaborations from the music industry.

Please respond with JSON in this exact format:
{
  "collaborators": [
    {
      "name": "Person Name",
      "roles": ["producer", "songwriter"], 
      "topCollaborators": ["Artist 1", "Artist 2", "Artist 3"]
    }
  ]
}

Guidelines:
- Include real music industry professionals who have worked with ${collaboratorName}
- List ALL their roles from: ["producer", "songwriter", "artist"]
- Include 5-8 collaborators maximum
- Focus on well-documented collaborations
- Never use placeholder names like "John Doe", "Producer X", etc.
- Include their top 3 collaborating artists
- If ${collaboratorName} has limited collaboration data, include similar professionals they might work with`;

    // Call OpenAI
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a music industry database expert. Provide accurate collaboration data for music professionals."
        },
        {
          role: "user",
          content: promptText
        }
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const openaiContent = completion?.choices?.[0]?.message?.content;
    
    if (!openaiContent) {
      return res.status(503).json({ 
        error: 'OpenAI API returned empty response',
        message: 'Failed to generate collaboration data'
      });
    }

    // Parse OpenAI response
    let jsonContent = openaiContent.trim();
    jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    
    const jsonStart = jsonContent.indexOf('{');
    const jsonEnd = jsonContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
    }

    let collaborationData;
    try {
      collaborationData = JSON.parse(jsonContent);
    } catch (parseError) {
      return res.status(503).json({ 
        error: 'Failed to parse OpenAI response',
        message: 'OpenAI returned invalid JSON format'
      });
    }

    // Build network data structure
    const nodeMap = new Map<string, NetworkNode>();
    const linksList: NetworkLink[] = [];

    // Add the main collaborator node
    const mainNode: NetworkNode = {
      id: collaboratorName,
      name: collaboratorName,
      type: collaboratorRoles[0],
      types: collaboratorRoles,
      size: 25,
      artistId: null,
      imageUrl: null
    };
    nodeMap.set(collaboratorName, mainNode);

    // Add collaborators from OpenAI response
    if (collaborationData?.collaborators && Array.isArray(collaborationData.collaborators)) {
      for (const person of collaborationData.collaborators) {
        // Skip invalid entries or the main collaborator if included
        if (!person || !person.name || typeof person.name !== 'string' || person.name === collaboratorName) {
          continue;
        }

        // Create collaborator node
        const collaboratorNode: NetworkNode = {
          id: person.name,
          name: person.name,
          type: person.roles?.[0] || 'artist',
          types: person.roles || ['artist'],
          size: 15,
          artistId: null,
          imageUrl: null
        };
        nodeMap.set(person.name, collaboratorNode);

        // Create link between main collaborator and this person
        linksList.push({
          source: collaboratorName,
          target: person.name
        });

        // Add some of their top collaborators for richer network
        if (person.topCollaborators && Array.isArray(person.topCollaborators)) {
          for (const topCollab of person.topCollaborators.slice(0, 2)) {
            if (typeof topCollab === 'string' && topCollab !== collaboratorName && !nodeMap.has(topCollab)) {
              const topCollabNode: NetworkNode = {
                id: topCollab,
                name: topCollab,
                type: 'artist',
                types: ['artist'],
                size: 12,
                artistId: null,
                imageUrl: null
              };
              nodeMap.set(topCollab, topCollabNode);

              // Link to the intermediate collaborator
              linksList.push({
                source: person.name,
                target: topCollab
              });
            }
          }
        }
      }
    }

    const networkData: NetworkData = {
      nodes: Array.from(nodeMap.values()),
      links: linksList
    };

    console.log(`🤖✅ [Generate-Collaborator] Generated network for ${collaboratorName} with ${networkData.nodes.length} nodes and ${networkData.links.length} links`);

    res.json(networkData);
    
  } catch (error) {
    console.error('❌ [Generate-Collaborator] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      message: 'Failed to generate network collaboration data',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
} 