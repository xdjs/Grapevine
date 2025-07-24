// Test script for collaboration API with multiple roles
const testCollaborationAPI = async () => {
  try {
    console.log('🧪 Testing collaboration API with multiple roles...');
    
    // Simulate the new API response format
    const mockResponse = {
      collaborationInfo: "Taylor Swift and Jack Antonoff have collaborated extensively on multiple albums, with Jack serving as both producer and songwriter.",
      projects: [
        {
          name: "1989",
          year: "2014",
          roles: {
            "Taylor Swift": "artist, songwriter",
            "Jack Antonoff": "producer, songwriter"
          }
        },
        {
          name: "Lover",
          year: "2019",
          roles: {
            "Taylor Swift": "artist, songwriter",
            "Jack Antonoff": "producer, songwriter, instrumentalist"
          }
        },
        {
          name: "Folklore",
          year: "2020",
          roles: {
            "Taylor Swift": "artist, songwriter",
            "Jack Antonoff": "producer, songwriter, instrumentalist"
          }
        }
      ],
      personalHistory: "Jack Antonoff and Taylor Swift have developed a close working relationship since 2014, with Jack becoming one of her primary collaborators.",
      spotifyTracks: []
    };
    
    console.log('✅ Simulated API response with multiple roles:');
    console.log('Response:', JSON.stringify(mockResponse, null, 2));
    
    // Test the new format
    console.log('\n📊 Analysis:');
    console.log(`- Number of projects: ${mockResponse.projects.length}`);
    mockResponse.projects.forEach((project, index) => {
      console.log(`- Project ${index + 1}: ${project.name} (${project.year})`);
      Object.entries(project.roles).forEach(([artist, roles]) => {
        console.log(`  • ${artist}: ${roles}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
};

// Run the test
testCollaborationAPI(); 