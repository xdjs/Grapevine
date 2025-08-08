#!/usr/bin/env node

/**
 * Test script for different music types (albums, EPs, singles, songs)
 * Tests that all types are properly handled in Spotify search
 * Usage: node test-music-types.js
 */

import 'dotenv/config';

// Test cases with different music types
const MUSIC_TYPE_TESTS = [
  {
    artist: "Taylor Swift",
    collaborator: "Jack Antonoff",
    expectedProjects: [
      { name: "Midnights", type: "album", shouldFindSpotifyUrl: true },
      { name: "folklore", type: "album", shouldFindSpotifyUrl: true },
      { name: "Anti-Hero", type: "song", shouldFindSpotifyUrl: true },
      { name: "Lavender Haze", type: "single", shouldFindSpotifyUrl: true }
    ]
  },
  {
    artist: "Billie Eilish",
    collaborator: "FINNEAS",
    expectedProjects: [
      { name: "When We All Fall Asleep, Where Do We Go?", type: "album", shouldFindSpotifyUrl: true },
      { name: "Happier Than Ever", type: "album", shouldFindSpotifyUrl: true },
      { name: "bad guy", type: "song", shouldFindSpotifyUrl: true },
      { name: "Therefore I Am", type: "single", shouldFindSpotifyUrl: true }
    ]
  },
  {
    artist: "The 1975",
    collaborator: "George Daniel",
    expectedProjects: [
      { name: "A Brief Inquiry into Online Relationships", type: "album", shouldFindSpotifyUrl: true },
      { name: "Notes on a Conditional Form", type: "album", shouldFindSpotifyUrl: true }
    ]
  }
];

// Spotify type mapping reference
const SPOTIFY_TYPE_MAPPING = {
  'song': { searchType: 'track', responseKey: 'tracks', urlType: 'track' },
  'single': { searchType: 'track', responseKey: 'tracks', urlType: 'track' },
  'album': { searchType: 'album', responseKey: 'albums', urlType: 'album' },
  'ep': { searchType: 'album', responseKey: 'albums', urlType: 'album' }
};

async function testMusicTypes() {
  console.log('🧪 Testing Different Music Types in Collaboration Details\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not found in environment variables');
    console.error('Please set OPENAI_API_KEY');
    return;
  }

  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000';
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of MUSIC_TYPE_TESTS) {
    console.log(`\n🎯 Testing: ${testCase.artist} & ${testCase.collaborator}`);
    console.log('=' .repeat(80));

    try {
      // Test the collaboration details API
      const response = await fetch(
        `${baseUrl}/api/collaboration-details/${encodeURIComponent(testCase.artist)}/${encodeURIComponent(testCase.collaborator)}`
      );

      if (!response.ok) {
        console.log(`❌ API Error: ${response.status} - ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      
      console.log(`\n📝 API Response:`);
      console.log(`   Description: "${data.description}"`);
      console.log(`   Projects found: ${data.projects?.length || 0}`);

      if (data.projects && data.projects.length > 0) {
        console.log(`\n🎵 Music Type Analysis:`);
        
        let typeBreakdown = {
          song: { found: 0, withUrls: 0 },
          single: { found: 0, withUrls: 0 },
          album: { found: 0, withUrls: 0 },
          ep: { found: 0, withUrls: 0 }
        };

        for (const project of data.projects) {
          totalTests++;
          
          console.log(`\n   📀 Project: "${project.name}"`);
          console.log(`      Type: ${project.type}`);
          console.log(`      Year: ${project.year || 'Unknown'}`);
          
          // Update type breakdown
          if (typeBreakdown[project.type]) {
            typeBreakdown[project.type].found++;
          }
          
          if (project.spotifyUrl) {
            console.log(`      Spotify URL: ${project.spotifyUrl}`);
            
            if (typeBreakdown[project.type]) {
              typeBreakdown[project.type].withUrls++;
            }
            
            // Validate URL type matches project type
            const expectedMapping = SPOTIFY_TYPE_MAPPING[project.type];
            if (expectedMapping) {
              const actualUrlType = project.spotifyUrl.includes('/track/') ? 'track' : 'album';
              const expectedUrlType = expectedMapping.urlType;
              
              if (actualUrlType === expectedUrlType) {
                passedTests++;
                console.log(`      ✅ URL type matches expected (${expectedUrlType})`);
              } else {
                failedTests++;
                console.log(`      ❌ URL type mismatch! Expected: ${expectedUrlType}, Got: ${actualUrlType}`);
              }
              
              // Validate URL format
              const urlPattern = new RegExp(`^https://open\\.spotify\\.com/${expectedUrlType}/[a-zA-Z0-9]+$`);
              if (urlPattern.test(project.spotifyUrl)) {
                console.log(`      ✅ URL format is valid`);
              } else {
                console.log(`      ⚠️  URL format may be invalid`);
              }
              
              // Extract and validate ID length (should be 22 characters for Spotify)
              const idMatch = project.spotifyUrl.match(/\/[a-zA-Z0-9]+$/);
              if (idMatch) {
                const id = idMatch[0].substring(1); // Remove leading slash
                if (id.length === 22) {
                  console.log(`      ✅ Spotify ID length is correct (22 chars)`);
                } else {
                  console.log(`      ⚠️  Spotify ID length is unusual (${id.length} chars): ${id}`);
                }
              }
              
            } else {
              console.log(`      ⚠️  Unknown project type: ${project.type}`);
            }
            
          } else {
            console.log(`      Spotify URL: Not provided`);
            console.log(`      ℹ️  This may be normal if the collaboration isn't on Spotify`);
          }
        }

        // Display type breakdown
        console.log(`\n📊 Type Breakdown:`);
        for (const [type, stats] of Object.entries(typeBreakdown)) {
          if (stats.found > 0) {
            const percentage = stats.withUrls > 0 ? Math.round((stats.withUrls / stats.found) * 100) : 0;
            console.log(`   ${type.toUpperCase()}: ${stats.found} found, ${stats.withUrls} with URLs (${percentage}%)`);
          }
        }

        // Check for expected projects
        console.log(`\n🔍 Expected Project Validation:`);
        for (const expectedProject of testCase.expectedProjects) {
          const foundProject = data.projects.find(p => 
            p.name.toLowerCase().includes(expectedProject.name.toLowerCase()) ||
            expectedProject.name.toLowerCase().includes(p.name.toLowerCase())
          );
          
          if (foundProject) {
            console.log(`   ✅ "${expectedProject.name}" found as "${foundProject.name}"`);
            console.log(`      Expected type: ${expectedProject.type}, Found type: ${foundProject.type}`);
            
            if (expectedProject.shouldFindSpotifyUrl && foundProject.spotifyUrl) {
              console.log(`      ✅ Spotify URL provided as expected`);
            } else if (expectedProject.shouldFindSpotifyUrl && !foundProject.spotifyUrl) {
              console.log(`      ⚠️  Expected Spotify URL but none provided`);
            } else if (!expectedProject.shouldFindSpotifyUrl && foundProject.spotifyUrl) {
              console.log(`      ⚠️  Unexpected Spotify URL provided`);
            } else {
              console.log(`      ✅ URL provision matches expectation`);
            }
          } else {
            console.log(`   ❌ "${expectedProject.name}" not found in results`);
          }
        }

      } else {
        console.log(`\n ℹ️  No projects found - this may be normal for some collaborations`);
      }

    } catch (error) {
      failedTests++;
      console.error(`❌ Test failed for ${testCase.artist} & ${testCase.collaborator}:`, error.message);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('🎯 MUSIC TYPE TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`📊 Total URL validations: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  
  if (totalTests > 0) {
    const successRate = Math.round((passedTests / totalTests) * 100);
    console.log(`📈 Success rate: ${successRate}%`);
    
    if (successRate >= 90) {
      console.log(`🏆 EXCELLENT: Music type handling is working well!`);
    } else if (successRate >= 70) {
      console.log(`👍 GOOD: Music type handling is mostly working`);
    } else {
      console.log(`⚠️  NEEDS IMPROVEMENT: Music type handling has issues`);
    }
  }

  console.log('\n💡 Key Checks Performed:');
  console.log('   • URL type matching (track URLs for songs/singles, album URLs for albums/EPs)');
  console.log('   • URL format validation');
  console.log('   • Spotify ID length validation');
  console.log('   • Expected project detection');
  console.log('   • Type-specific search handling');
  
  console.log('\n✅ Music type test completed!');
}

// Run the test
testMusicTypes().catch(console.error); 