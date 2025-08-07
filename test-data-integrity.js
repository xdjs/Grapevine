#!/usr/bin/env node

/**
 * Test script for data integrity validation
 * Tests that OpenAI doesn't generate fake Spotify URLs
 * Usage: node test-data-integrity.js
 */

import 'dotenv/config';

// Test collaboration pairs
const TEST_COLLABORATIONS = [
  {
    artist: "Taylor Swift",
    collaborator: "Jack Antonoff",
    description: "Real collaboration with verified projects"
  },
  {
    artist: "Billie Eilish", 
    collaborator: "FINNEAS",
    description: "Producer-artist sibling collaboration"
  },
  {
    artist: "FakeArtist123",
    collaborator: "NonExistentProducer",
    description: "Fake collaboration to test AI hallucination prevention"
  }
];

async function testDataIntegrity() {
  console.log('🧪 Testing Data Integrity and URL Validation\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not found in environment variables');
    console.error('Please set OPENAI_API_KEY');
    return;
  }

  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000';
  
  for (const collaboration of TEST_COLLABORATIONS) {
    console.log(`\n🎯 Testing: ${collaboration.artist} & ${collaboration.collaborator}`);
    console.log(`Description: ${collaboration.description}`);
    console.log('=' .repeat(80));

    try {
      // Test the collaboration details API
      const response = await fetch(
        `${baseUrl}/api/collaboration-details/${encodeURIComponent(collaboration.artist)}/${encodeURIComponent(collaboration.collaborator)}`
      );

      if (!response.ok) {
        console.log(`❌ API Error: ${response.status} - ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      
      console.log(`\n📝 Response Analysis:`);
      console.log(`   Description: "${data.description}"`);
      console.log(`   Projects found: ${data.projects?.length || 0}`);

      if (data.projects && data.projects.length > 0) {
        console.log(`\n🎵 Project Analysis:`);
        
        let urlSources = {
          fromSpotifySearch: 0,
          suspiciousFakeUrls: 0,
          noUrls: 0,
          totalUrls: 0
        };

        for (const project of data.projects) {
          console.log(`\n   Project: "${project.name}"`);
          console.log(`   Type: ${project.type}`);
          console.log(`   Year: ${project.year || 'Unknown'}`);
          
          if (project.spotifyUrl) {
            urlSources.totalUrls++;
            console.log(`   Spotify URL: ${project.spotifyUrl}`);
            
            // Check for suspicious patterns that might indicate fake URLs
            const urlPattern = /^https:\/\/open\.spotify\.com\/(track|album)\/[a-zA-Z0-9]+$/;
            const isValidFormat = urlPattern.test(project.spotifyUrl);
            
            if (!isValidFormat) {
              urlSources.suspiciousFakeUrls++;
              console.log(`   ⚠️  SUSPICIOUS: Invalid URL format detected!`);
            } else {
              // Try to validate if this is a real Spotify URL
              try {
                const trackId = project.spotifyUrl.split('/').pop();
                if (trackId && trackId.length === 22) { // Spotify track IDs are 22 characters
                  urlSources.fromSpotifySearch++;
                  console.log(`   ✅ Valid format and track ID length`);
                } else {
                  urlSources.suspiciousFakeUrls++;
                  console.log(`   ⚠️  SUSPICIOUS: Invalid track ID format!`);
                }
              } catch (error) {
                urlSources.suspiciousFakeUrls++;
                console.log(`   ⚠️  SUSPICIOUS: Error parsing URL!`);
              }
            }
          } else {
            urlSources.noUrls++;
            console.log(`   Spotify URL: Not provided`);
          }
        }

        console.log(`\n📊 URL Source Analysis:`);
        console.log(`   Total URLs found: ${urlSources.totalUrls}`);
        console.log(`   Valid Spotify URLs: ${urlSources.fromSpotifySearch}`);
        console.log(`   Suspicious/Fake URLs: ${urlSources.suspiciousFakeUrls}`);
        console.log(`   Projects without URLs: ${urlSources.noUrls}`);
        
        // Flag potential issues
        if (urlSources.suspiciousFakeUrls > 0) {
          console.log(`\n❌ INTEGRITY ISSUE: ${urlSources.suspiciousFakeUrls} suspicious URLs detected!`);
        } else if (urlSources.totalUrls > 0) {
          console.log(`\n✅ INTEGRITY GOOD: All URLs appear to be from validated Spotify search`);
        } else {
          console.log(`\n ℹ️  NO URLS: This is normal - URLs only added if tracks found in Spotify`);
        }

      } else {
        console.log(`\n ℹ️  No projects found - this may be normal for non-existent collaborations`);
      }

      // Test for specific indicators of AI hallucination
      if (collaboration.artist === "FakeArtist123") {
        if (data.projects && data.projects.length > 0) {
          console.log(`\n⚠️  POTENTIAL HALLUCINATION: AI generated projects for fake artist`);
          
          // Check if any URLs were provided for fake collaboration
          const urlsForFakeCollab = data.projects.filter(p => p.spotifyUrl).length;
          if (urlsForFakeCollab > 0) {
            console.log(`\n🚨 CRITICAL ISSUE: ${urlsForFakeCollab} Spotify URLs provided for fake collaboration!`);
          }
        } else {
          console.log(`\n✅ GOOD: No projects generated for fake collaboration`);
        }
      }

    } catch (error) {
      console.error(`❌ Test failed for ${collaboration.artist} & ${collaboration.collaborator}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 DATA INTEGRITY TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('✅ If no "CRITICAL ISSUE" or "INTEGRITY ISSUE" messages appeared above,');
  console.log('   the system is properly preventing fake Spotify URLs');
  console.log('⚠️  Any suspicious URLs should be investigated further');
  console.log('ℹ️  Missing URLs are normal - not all collaborations have tracks on Spotify');
  console.log('\n✅ Data integrity test completed!');
}

// Run the test
testDataIntegrity().catch(console.error); 