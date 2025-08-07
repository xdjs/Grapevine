#!/usr/bin/env node

/**
 * Test script for Spotify URL validation and market-aware search
 * Usage: node test-spotify-url-validation.js
 */

import 'dotenv/config';

// Test cases with URLs that might have market restrictions
const TEST_CASES = [
  {
    name: "Known Good Track (Global)",
    trackId: "4iV5W9uYEdYUVa79Axb7Rh", // "Never Gonna Give You Up" - Rick Astley
    expectedValid: true
  },
  {
    name: "Potential Market Restricted Track",
    trackId: "6kLCHFM39wkFjOuyPGLGeQ", // Example from Spotify docs - not available in US
    expectedValid: false
  },
  {
    name: "Taylor Swift Track",
    trackId: "1BxfuPKGuaTgP7aM0Bbdwr", // "Lavender Haze"
    expectedValid: true
  }
];

async function testUrlValidation() {
  console.log('🧪 Testing Spotify URL Validation and Market Handling\n');
  
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

    // Test different markets
    const marketsToTest = ['US', 'GB', 'CA', 'AU', 'DE', 'FR'];
    
    for (const testCase of TEST_CASES) {
      console.log(`\n🎵 Testing: ${testCase.name}`);
      console.log(`Track ID: ${testCase.trackId}`);
      console.log('=' .repeat(60));

      for (const market of marketsToTest) {
        try {
          const trackResponse = await axios.get(
            `https://api.spotify.com/v1/tracks/${testCase.trackId}`,
            {
              params: { market },
              headers: {
                'Authorization': `Bearer ${spotifyToken}`
              }
            }
          );

          const track = trackResponse.data;
          const isPlayable = track.is_playable;
          const restrictions = track.restrictions;
          const url = track.external_urls?.spotify;
          
          console.log(`   ${market}: ${isPlayable === true ? '✅ Playable' : isPlayable === false ? '❌ Not Playable' : '❓ Unknown'}`);
          
          if (restrictions) {
            console.log(`        Restrictions: ${restrictions.reason}`);
          }
          
          if (track.linked_from) {
            console.log(`        Relinked from: ${track.linked_from.id}`);
          }
          
          console.log(`        URL: ${url}`);
          
        } catch (error) {
          const status = error.response?.status;
          console.log(`   ${market}: ❌ Error ${status} - ${error.message}`);
        }
      }

      // Test URL validation function
      console.log(`\n🔍 Testing URL Validation for ${testCase.name}:`);
      const baseUrl = `https://open.spotify.com/track/${testCase.trackId}`;
      
      try {
        const isValid = await validateSpotifyUrl(baseUrl, spotifyToken, testCase.trackId);
        const result = isValid ? '✅ Valid' : '❌ Invalid';
        const expected = testCase.expectedValid ? '✅ Expected Valid' : '❌ Expected Invalid';
        const match = isValid === testCase.expectedValid ? '✅ Match' : '❌ Mismatch';
        
        console.log(`   Result: ${result} | Expected: ${expected} | ${match}`);
        
      } catch (error) {
        console.log(`   Error testing validation: ${error.message}`);
      }
    }

    // Test the alternative market finding
    console.log(`\n\n🌍 Testing Alternative Market Finding:`);
    console.log('=' .repeat(60));
    
    const restrictedTrackId = TEST_CASES[1].trackId; // Use potentially restricted track
    try {
      const alternativeUrl = await findAlternativeMarketUrl(restrictedTrackId, spotifyToken);
      if (alternativeUrl) {
        console.log(`✅ Found alternative URL: ${alternativeUrl}`);
      } else {
        console.log(`❌ No alternative URL found`);
      }
    } catch (error) {
      console.log(`❌ Error finding alternative: ${error.message}`);
    }

    console.log('\n✅ URL validation test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Validation function (copied from main implementation for testing)
async function validateSpotifyUrl(spotifyUrl, spotifyToken, trackId) {
  try {
    const axios = (await import('axios')).default;
    
    const trackResponse = await axios.get(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        params: { market: 'US' },
        headers: {
          'Authorization': `Bearer ${spotifyToken}`
        }
      }
    );

    const track = trackResponse.data;
    
    if (track.is_playable === false) {
      console.log(`   ⚠️ Track ${trackId} not playable in US market`);
      return false;
    }

    if (track.restrictions && track.restrictions.reason) {
      console.log(`   ⚠️ Track ${trackId} has restrictions: ${track.restrictions.reason}`);
      return false;
    }

    if (!spotifyUrl.match(/^https:\/\/open\.spotify\.com\/(track|album)\/[a-zA-Z0-9]+/)) {
      console.log(`   ⚠️ Invalid URL format: ${spotifyUrl}`);
      return false;
    }

    return true;

  } catch (error) {
    console.log(`   ⚠️ Validation failed: ${error.response?.status || error.message}`);
    return error.response?.status !== 404;
  }
}

// Alternative market function (copied from main implementation for testing)
async function findAlternativeMarketUrl(trackId, spotifyToken) {
  try {
    const axios = (await import('axios')).default;
    const markets = ['US', 'GB', 'CA', 'AU', 'DE', 'FR'];
    
    for (const market of markets) {
      try {
        console.log(`   🔍 Trying market ${market} for track ${trackId}`);
        
        const trackResponse = await axios.get(
          `https://api.spotify.com/v1/tracks/${trackId}`,
          {
            params: { market },
            headers: {
              'Authorization': `Bearer ${spotifyToken}`
            }
          }
        );

        const track = trackResponse.data;
        
        if (track.is_playable !== false && !track.restrictions) {
          const alternativeUrl = track.external_urls?.spotify;
          if (alternativeUrl) {
            console.log(`   ✅ Found playable version in market ${market}: ${alternativeUrl}`);
            return alternativeUrl;
          }
        }
        
      } catch (marketError) {
        console.log(`   ⚠️ Market ${market} failed: ${marketError.response?.status || marketError.message}`);
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`   ❌ Error finding alternative markets: ${error.message}`);
    return null;
  }
}

// Run the test
testUrlValidation().catch(console.error); 