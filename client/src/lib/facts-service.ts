interface ArtistFact {
  text: string;
  category: 'career' | 'personal' | 'collaboration' | 'achievement' | 'trivia';
}

// Predefined fun facts for various artists as fallback
const PREDEFINED_FACTS: Record<string, ArtistFact[]> = {
  'taylor swift': [
    { text: "Taylor Swift wrote her first song at age 12 and signed her first record deal at 15.", category: 'career' },
    { text: "She's the only artist to have 4 albums sell over 1 million copies in their first week.", category: 'achievement' },
    { text: "Taylor has won 12 Grammy Awards and is the first female artist to win Album of the Year three times.", category: 'achievement' },
    { text: "She taught herself to play guitar by watching YouTube videos.", category: 'personal' },
    { text: "Taylor's favorite number is 13, and she often incorporates it into her music and performances.", category: 'trivia' }
  ],
  'jack antonoff': [
    { text: "Jack Antonoff started his first band in high school and has been making music ever since.", category: 'career' },
    { text: "He's worked with artists like Taylor Swift, Lana Del Rey, and Lorde, becoming one of pop's most sought-after producers.", category: 'collaboration' },
    { text: "Jack is also the frontman of the band Bleachers.", category: 'career' },
    { text: "He won a Grammy for Producer of the Year in 2022.", category: 'achievement' },
    { text: "Jack has a unique production style that often includes vintage synthesizers and drum machines.", category: 'trivia' }
  ],
  'lorde': [
    { text: "Lorde released her first EP at just 16 years old.", category: 'career' },
    { text: "She became the youngest solo artist to achieve a US number-one single since 1987.", category: 'achievement' },
    { text: "Lorde wrote 'Royals' when she was just 15 years old.", category: 'career' },
    { text: "She's known for her unique vocal style and poetic lyrics.", category: 'trivia' },
    { text: "Lorde has collaborated with artists like Disclosure, Khalid, and Jack Antonoff.", category: 'collaboration' }
  ],
  'lana del rey': [
    { text: "Lana Del Rey's real name is Elizabeth Grant.", category: 'personal' },
    { text: "She studied philosophy at Fordham University before pursuing music full-time.", category: 'personal' },
    { text: "Lana's breakthrough hit 'Video Games' was written and recorded in her bedroom.", category: 'career' },
    { text: "She's known for her cinematic, vintage aesthetic and dreamy vocals.", category: 'trivia' },
    { text: "Lana has worked with producers like Jack Antonoff and Rick Nowels.", category: 'collaboration' }
  ]
};

// Generic facts for different artist types
const GENERIC_FACTS: ArtistFact[] = [
  { text: "This artist has collaborated with some of the biggest names in music.", category: 'collaboration' },
  { text: "They've been making music for years and have a dedicated fanbase.", category: 'career' },
  { text: "Their unique sound has influenced many other artists in the industry.", category: 'achievement' },
  { text: "They're known for their innovative approach to music production.", category: 'trivia' },
  { text: "This artist has toured around the world and performed at major venues.", category: 'career' },
  { text: "They've received critical acclaim for their musical contributions.", category: 'achievement' },
  { text: "Their music spans multiple genres and appeals to diverse audiences.", category: 'trivia' },
  { text: "They've worked with both established and up-and-coming artists.", category: 'collaboration' }
];

export class FactsService {
  private static instance: FactsService;
  private factCache: Map<string, ArtistFact[]> = new Map();

  static getInstance(): FactsService {
    if (!FactsService.instance) {
      FactsService.instance = new FactsService();
    }
    return FactsService.instance;
  }

  async generateFacts(artistName: string): Promise<string[]> {
    const normalizedName = artistName.toLowerCase().trim();
    
    // Check cache first
    if (this.factCache.has(normalizedName)) {
      return this.factCache.get(normalizedName)!.map(fact => fact.text);
    }

    try {
      // Try to generate facts using OpenAI
      const facts = await this.generateFactsWithAI(artistName);
      if (facts && facts.length > 0) {
        this.factCache.set(normalizedName, facts);
        return facts.map(fact => fact.text);
      }
    } catch (error) {
      console.warn('Failed to generate AI facts, using fallback:', error);
    }

    // Fallback to predefined facts or generic facts
    const fallbackFacts = PREDEFINED_FACTS[normalizedName] || GENERIC_FACTS;
    const selectedFacts = this.shuffleArray(fallbackFacts).slice(0, 5);
    
    this.factCache.set(normalizedName, selectedFacts);
    return selectedFacts.map(fact => fact.text);
  }

  private async generateFactsWithAI(artistName: string): Promise<ArtistFact[]> {
    try {
      const response = await fetch('/api/generate-facts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ artistName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.facts || [];
    } catch (error) {
      console.error('Error generating AI facts:', error);
      throw error;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  clearCache(): void {
    this.factCache.clear();
  }
}

export default FactsService.getInstance();
