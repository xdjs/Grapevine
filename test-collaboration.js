// Simple test script for collaboration API
const testCollaborationAPI = async () => {
  try {
    console.log('🧪 Testing collaboration API...');
    
    const response = await fetch('http://localhost:3000/api/collaboration-info?artistName=Taylor%20Swift&collaboratorName=Jack%20Antonoff');
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Collaboration API test successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Collaboration API test failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
};

// Run the test
testCollaborationAPI(); 