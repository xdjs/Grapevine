import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/server/openai-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { artistName: string } }
) {
  try {
    const artistName = decodeURIComponent(params.artistName);
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [API] Grape content request received for artist: ${artistName}`);
    
    if (!artistName) {
      console.log(`🕐 [${new Date().toISOString()}] ❌ [API] Artist name is empty, returning 400 error`);
      return NextResponse.json(
        { error: 'Artist name is required' },
        { status: 400 }
      );
    }

    console.log(`🕐 [${new Date().toISOString()}] 🍇 [API] Starting content generation for artist: ${artistName}`);

    // Create a prompt for OpenAI to generate grape popup content
    const prompt = `Tell me a fun fact about the most recent project that ${artistName} and their collaborators worked on together. Keep your answer short but informative. Do not include "Fun Fact:" or mention fun facts in your answer; only show the information. Do not ask for any extra questions or clarification.`;

    console.log(`🕐 [${new Date().toISOString()}] 🍇 [API] Making OpenAI API call for artist: ${artistName}`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a music expert who provides concise, factual information about recent music collaborations. Keep responses under 100 words and focus on specific, interesting details about recent projects."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    console.log(`🕐 [${new Date().toISOString()}] 🍇 [API] OpenAI API call completed for artist: ${artistName}`);

    const content = completion.choices[0]?.message?.content?.trim();

    if (!content) {
      console.log(`🕐 [${new Date().toISOString()}] ❌ [API] No content generated from OpenAI for artist: ${artistName}`);
      throw new Error('No content generated from OpenAI');
    }

    console.log(`🕐 [${new Date().toISOString()}] ✅ [API] Generated content for ${artistName}:`, content);

    console.log(`🕐 [${new Date().toISOString()}] 🍇 [API] Returning successful response for artist: ${artistName}`);
    return NextResponse.json({
      content,
      artistName,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`🕐 [${new Date().toISOString()}] ❌ [API] Error generating content for artist ${artistName}:`, error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate grape content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
