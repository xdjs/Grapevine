import { openAIService } from '../server/openai-service';

/**
 * Example: Using the new Spotify "appears on" collaboration detection
 * 
 * This demonstrates how to find verified collaborators from Spotify's
 * "appears on" section while excluding compilation albums.
 */

async function exampleSpotifyAppearsOnAnalysis() {
  console.log('🎵 Spotify "Appears On" Collaboration Analysis Example\n');

  try {
    // Example 1: Analyze a well-known artist's "appears on" section
    console.log('🔍 Analyzing Post Malone\'s "appears on" collaborations...');
    const postMaloneCollaborators = await openAIService.getSpotifyAppearsOnCollaborators('Post Malone');
    
    console.log(`✅ Found ${postMaloneCollaborators.artists.length} verified collaborators:`);
    postMaloneCollaborators.artists.forEach((collaborator, index) => {
      console.log(`  ${index + 1}. ${collaborator.name} (${collaborator.type})`);
      if (collaborator.collaborationType) {
        console.log(`     Type: ${collaborator.collaborationType}`);
      }
      if (collaborator.verificationLevel) {
        console.log(`     Verification: ${collaborator.verificationLevel}`);
      }
      if (collaborator.topCollaborators.length > 0) {
        console.log(`     Top collaborators: ${collaborator.topCollaborators.join(', ')}`);
      }
      console.log('');
    });

    // Example 2: Analyze a producer's "appears on" section
    console.log('🔍 Analyzing Metro Boomin\'s "appears on" collaborations...');
    const metroBoominCollaborators = await openAIService.getSpotifyAppearsOnCollaborators('Metro Boomin');
    
    console.log(`✅ Found ${metroBoominCollaborators.artists.length} verified collaborators:`);
    metroBoominCollaborators.artists.forEach((collaborator, index) => {
      console.log(`  ${index + 1}. ${collaborator.name} (${collaborator.type})`);
      if (collaborator.collaborationType) {
        console.log(`     Type: ${collaborator.collaborationType}`);
      }
      if (collaborator.verificationLevel) {
        console.log(`     Verification: ${collaborator.verificationLevel}`);
      }
      console.log('');
    });

    // Example 3: Show how compilation albums are filtered out
    console.log('🔍 Analyzing an artist with potential compilation appearances...');
    const compilationTestCollaborators = await openAIService.getSpotifyAppearsOnCollaborators('Various Artists');
    
    console.log(`✅ Found ${compilationTestCollaborators.artists.length} verified collaborators (compilations filtered out):`);
    if (compilationTestCollaborators.artists.length === 0) {
      console.log('  ✅ Correctly filtered out compilation albums and unverified collaborations');
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

// Key Benefits of the New Method:
console.log('🚀 Key Benefits of Spotify "Appears On" Analysis:\n');
console.log('✅ Focuses on VERIFIED collaborations only');
console.log('✅ Excludes compilation albums (Greatest Hits, Soundtracks, Various Artists)');
console.log('✅ Identifies different collaboration types (featured artist, producer, songwriter)');
console.log('✅ Provides verification levels (high/medium/low)');
console.log('✅ Maps to existing collaboration data structure');
console.log('✅ Uses specialized prompt for Spotify analysis\n');

// Run the example
if (require.main === module) {
  exampleSpotifyAppearsOnAnalysis();
}

export { exampleSpotifyAppearsOnAnalysis };
