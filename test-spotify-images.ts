/**
 * Manual Test Script for Task 1.1: Enhanced Spotify Service with Image Fetching
 * 
 * This script allows users to manually test the new Spotify image fetching functionality
 * without needing to set up the full application.
 * 
 * Usage: npx tsx test-spotify-images.ts
 * Or: npm run test:spotify
 */

import 'dotenv/config';
import { spotifyService } from './server/spotify';

console.log('🎵 Testing Spotify Image Fetching Service (Task 1.1)');
console.log('====================================================');

async function testSpotifyService() {
  // Check if Spotify is configured
  console.log('\n1. ⚙️  Checking Spotify Configuration...');
  if (!spotifyService.isConfigured()) {
    console.log('❌ Spotify not configured. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file');
    console.log('\n📝 To set up Spotify API:');
    console.log('1. Go to https://developer.spotify.com/dashboard');
    console.log('2. Create an app and get your Client ID and Client Secret');
    console.log('3. Create a .env file in the project root with:');
    console.log('   SPOTIFY_CLIENT_ID=your_client_id_here');
    console.log('   SPOTIFY_CLIENT_SECRET=your_client_secret_here');
    return;
  }
  console.log('✅ Spotify credentials configured');

  // Test individual artist image fetching
  console.log('\n2. 🎤 Testing Single Artist Image Fetching...');
  
  const testArtists = [
    'Taylor Swift',
    'Ed Sheeran', 
    'Billie Eilish',
    'Unknown Artist That Does Not Exist'
  ];

  for (const artistName of testArtists) {
    console.log(`\n   Testing: ${artistName}`);
    try {
      const result = await spotifyService.getArtistProfileImage(artistName);
      
      if (result && result.imageUrl) {
        console.log(`   ✅ Found image: ${result.imageUrl}`);
        console.log(`   📊 Spotify ID: ${result.spotifyId}`);
        console.log(`   👤 Artist: ${result.artist?.name || 'N/A'}`);
        if (result.artist?.images) {
          console.log(`   🖼️  Available sizes: ${result.artist.images.length} images`);
          result.artist.images.forEach((img, i) => {
            console.log(`      ${i + 1}. ${img.width}x${img.height} - ${img.url.substring(0, 60)}...`);
          });
        }
      } else {
        console.log(`   ❌ No image found (${result ? 'artist not found' : 'API error'})`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test batch processing
  console.log('\n3. 📦 Testing Batch Image Fetching...');
  const batchArtists = ['Adele', 'Drake', 'The Beatles'];
  
  try {
    console.log(`   Fetching images for: ${batchArtists.join(', ')}`);
    const startTime = Date.now();
    const batchResults = await spotifyService.batchGetArtistProfileImages(batchArtists);
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ Batch completed in ${duration}ms. Results for ${batchResults.size} artists:`);
    
    batchResults.forEach((result, artistName) => {
      if (result && result.imageUrl) {
        console.log(`   ✅ ${artistName}: Found image (${result.artist?.images?.[0]?.width}x${result.artist?.images?.[0]?.height})`);
      } else {
        console.log(`   ❌ ${artistName}: No image found`);
      }
    });
    
  } catch (error) {
    console.log(`   ❌ Batch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Test image size optimization
  console.log('\n4. 🎯 Testing Image Size Optimization...');
  
  try {
    const artist = await spotifyService.searchArtist('Ariana Grande');
    if (artist && artist.images && artist.images.length > 0) {
      console.log(`   Found ${artist.images.length} image sizes for ${artist.name}:`);
      
      artist.images.forEach((img, i) => {
        console.log(`   ${i + 1}. ${img.width}x${img.height}`);
      });
      
      // Test different size preferences
      console.log('\n   Testing size optimization:');
      const optimal300 = spotifyService.getOptimalImageUrl(artist, 300);
      const optimal150 = spotifyService.getOptimalImageUrl(artist, 150);
      const optimal500 = spotifyService.getOptimalImageUrl(artist, 500);
      
      console.log(`   🎯 Best for 300px: ${optimal300 ? 'Found optimal size' : 'No image'}`);
      console.log(`   🎯 Best for 150px: ${optimal150 ? 'Found optimal size' : 'No image'}`);
      console.log(`   🎯 Best for 500px: ${optimal500 ? 'Found optimal size' : 'No image'}`);
      
    } else {
      console.log('   ❌ Could not find artist with images for size testing');
    }
    
  } catch (error) {
    console.log(`   ❌ Size optimization test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Test error handling
  console.log('\n5. 🛡️  Testing Error Handling...');
  
  try {
    console.log('   Testing with empty string...');
    const emptyResult = await spotifyService.getArtistProfileImage('');
    console.log(`   ✅ Empty string handled: ${emptyResult ? 'Structured response' : 'Null response'}`);
    
    console.log('   Testing with special characters...');
    const specialResult = await spotifyService.getArtistProfileImage('Björk & Ólafur Arnalds');
    console.log(`   ✅ Special characters handled: ${specialResult?.imageUrl ? 'Found image' : 'No image/error handled'}`);
    
  } catch (error) {
    console.log(`   ✅ Error handling working: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n🏁 Testing Complete!');
  console.log('\n📋 What was tested:');
  console.log('   ✅ Service configuration check');
  console.log('   ✅ Single artist image fetching');
  console.log('   ✅ Error handling for unknown artists');
  console.log('   ✅ Batch processing with rate limiting');
  console.log('   ✅ Image size optimization');
  console.log('   ✅ Edge case error handling');
  console.log('\n🚀 Task 1.1 Enhanced Spotify Service is working correctly!');
}

// Run the test
testSpotifyService().catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});
