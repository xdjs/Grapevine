#!/usr/bin/env node

/**
 * Test script for improved Spotify search functionality
 * Usage: node test-spotify-search.js
 */

import 'dotenv/config';

// Test cases with known collaborations
const TEST_CASES = [
  {
    artist: "Taylor Swift",
    collaborator: "Jack Antonoff",
    projects: [
      { name: "Lavender Haze", type: "song" },
      { name: "Anti-Hero", type: "song" },
      { name: "Midnights", type: "album" }
    ]
  },
  {
    artist: "Ariana Grande",
    collaborator: "The Weeknd",
    projects: [
      { name: "Love Me Harder", type: "song" },
      { name: "off the table", type: "song" }
    ]
  },
  {
    artist: "Billie Eilish",
    collaborator: "FINNEAS",
    projects: [
      { name: "bad guy", type: "song" },
      { name: "When We All Fall Asleep, Where Do We Go?", type: "album" }
    ]
  }
];

// Import the validation functions (simplified versions for testing)
function validateSpotifyMatch(spotifyItem, project, artistName, collaboratorName) {
  let score = 0;
  const itemName = spotifyItem.name.toLowerCase();
  const projectName = project.name.toLowerCase();
  
  // Get artist names from the Spotify item
  const spotifyArtists = getArtistNames(spotifyItem).toLowerCase();
  const artistNameLower = artistName.toLowerCase();
  const collaboratorNameLower = collaboratorName.toLowerCase();
  
  // Title matching (most important factor)
  if (itemName === projectName) {
    score += 40; // Exact title match
  } else if (itemName.includes(projectName) || projectName.includes(itemName)) {
    score += 25; // Partial title match
  } else {
    // Check for common variations (remove parentheses, feat., etc.)
    const cleanItemName = itemName.replace(/\s*\([^)]*\)|\s*feat\.?.*|\s*ft\.?.*|\s*featuring.*$/i, '').trim();
    const cleanProjectName = projectName.replace(/\s*\([^)]*\)|\s*feat\.?.*|\s*ft\.?.*|\s*featuring.*$/i, '').trim();
    
    if (cleanItemName === cleanProjectName) {
      score += 35; // Clean title match
    } else if (cleanItemName.includes(cleanProjectName) || cleanProjectName.includes(cleanItemName)) {
      score += 20; // Clean partial match
    }
  }
  
  // Artist matching
  if (spotifyArtists.includes(artistNameLower)) {
    score += 25;
  }
  if (spotifyArtists.includes(collaboratorNameLower)) {
    score += 25;
  }
  
  // Check for common artist name variations
  const artistWords = artistNameLower.split(/\s+/);
  const collaboratorWords = collaboratorNameLower.split(/\s+/);
  
  for (const word of artistWords) {
    if (word.length > 2 && spotifyArtists.includes(word)) {
      score += 5;
    }
  }
  
  for (const word of collaboratorWords) {
    if (word.length > 2 && spotifyArtists.includes(word)) {
      score += 5;
    }
  }
  
  // Bonus for featuring/collaboration indicators
  if (spotifyArtists.includes('feat') || spotifyArtists.includes('featuring') || spotifyArtists.includes('ft')) {
    score += 10;
  }
  
  // Penalty for too many artists (likely compilation)
  const artistCount = spotifyItem.artists?.length || 0;
  if (artistCount > 4) {
    score -= 10;
  }
  
  return Math.max(0, score);
}

function getArtistNames(spotifyItem) {
  if (!spotifyItem.artists) return '';
  return spotifyItem.artists.map(artist => artist.name).join(' ');
}

async function testSpotifySearch() {
  console.log('🧪 Testing Spotify Search Improvements\n');
  
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('❌ Spotify credentials not found in environment variables');
    console.error('Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET');
    return;
  }

  try {
    // Get Spotify access token
    const axios = (await import('axios')).default;
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const spotifyToken = tokenResponse.data.access_token;
    console.log('✅ Successfully obtained Spotify access token\n');

    // Test each case
    for (const testCase of TEST_CASES) {
      console.log(`\n🎯 Testing: ${testCase.artist} & ${testCase.collaborator}`);
      console.log('=' .repeat(60));

      for (const project of testCase.projects) {
        console.log(`\n🔍 Searching for: "${project.name}" (${project.type})`);
        
        // Test multiple search strategies
        const searchStrategies = [
          `"${project.name}" artist:"${testCase.artist}"`,
          `"${project.name}" "${testCase.artist}" "${testCase.collaborator}"`,
          `${project.name} artist:${testCase.artist}`,
          `${project.name} ${testCase.artist}`,
          `${project.name}`,
        ];

        let bestMatch = null;
        let bestScore = 0;

        for (let i = 0; i < searchStrategies.length; i++) {
          const searchQuery = searchStrategies[i];
          console.log(`   Strategy ${i + 1}: "${searchQuery}"`);
          
          try {
            const searchResponse = await axios.get(
              'https://api.spotify.com/v1/search',
              {
                params: {
                  q: searchQuery,
                  type: project.type === 'song' ? 'track' : 'album',
                  limit: 3,
                  market: 'US'
                },
                headers: {
                  'Authorization': `Bearer ${spotifyToken}`
                }
              }
            );

            const items = searchResponse.data[project.type === 'song' ? 'tracks' : 'albums']?.items || [];
            
            if (items.length === 0) {
              console.log(`     No results found`);
              continue;
            }

            // Validate and score each result
            for (const item of items.slice(0, 2)) { // Only show top 2 results
              const score = validateSpotifyMatch(item, project, testCase.artist, testCase.collaborator);
              const artists = getArtistNames(item);
              console.log(`     "${item.name}" by ${artists} - Score: ${score}`);
              
              if (score > bestScore && score >= 50) {
                bestMatch = item;
                bestScore = score;
              }
            }

            // If we found a high-confidence match, stop searching
            if (bestScore >= 80) {
              console.log(`     ✅ High-confidence match found (${bestScore}), stopping search`);
              break;
            }
            
          } catch (strategyError) {
            console.log(`     ❌ Strategy failed: ${strategyError.message}`);
            continue;
          }
        }

        // Show final result
        if (bestMatch && bestScore >= 50) {
          console.log(`\n   🎵 BEST MATCH: "${bestMatch.name}" by ${getArtistNames(bestMatch)}`);
          console.log(`   📊 Score: ${bestScore}`);
          console.log(`   🔗 URL: ${bestMatch.external_urls?.spotify || 'N/A'}`);
        } else {
          console.log(`\n   ❌ No suitable match found (best score: ${bestScore})`);
        }
      }
    }

    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSpotifySearch().catch(console.error); 