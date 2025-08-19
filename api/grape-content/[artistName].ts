import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/server/openai-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { artistName: string } }
) {
  try {
    const artistName = decodeURIComponent(params.artistName);
    
    if (!artistName) {
      return NextResponse.json(
        { error: 'Artist name is required' },
        { status: 400 }
      );
    }

    console.log(`🍇 [GrapeContent] Generating content for artist: ${artistName}`);

    // Create a prompt for OpenAI to generate grape popup content
    const prompt = `Tell me a fun fact about the most recent project that ${artistName} and their collaborators worked on together. Keep your answer short but informative. Do not include "Fun Fact:" or mention fun facts in your answer; only show the information. Do not ask for any extra questions or clarification.`;

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

    const content = completion.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    console.log(`✅ [GrapeContent] Generated content for ${artistName}:`, content);

    return NextResponse.json({
      content,
      artistName,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GrapeContent] Error generating content:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate grape content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
