// Simple test for collaboration API with better error handling
const testCollaborationAPI = async () => {
  try {
    console.log('🧪 Testing collaboration API...');
    console.log('⏱️  This may take 10-30 seconds for the first request...');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/collaboration-info?artistName=Taylor%20Swift&collaboratorName=Jack%20Antonoff');
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`⏱️  Request completed in ${duration.toFixed(1)} seconds`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Collaboration API test successful!');
      console.log('📊 Response summary:');
      console.log(`   - Collaboration info: ${data.collaborationInfo ? 'Present' : 'Missing'}`);
      console.log(`   - Projects: ${data.projects ? data.projects.length : 0} found`);
      console.log(`   - Spotify tracks: ${data.spotifyTracks ? data.spotifyTracks.length : 0} found`);
      console.log(`   - Personal history: ${data.personalHistory ? 'Present' : 'Missing'}`);
      
      if (data.collaborationInfo) {
        console.log('\n📝 Collaboration info preview:');
        console.log(data.collaborationInfo.substring(0, 100) + '...');
      }
    } else {
      console.error('❌ Collaboration API test failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('💡 Make sure the server is running with: npm run dev');
  }
};

// Run the test
testCollaborationAPI(); 