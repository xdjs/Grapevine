import { useState } from "react";
import { Button } from "./ui/button";

export default function DebugShare() {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testSocialApi = async (artistId: string) => {
    setLoading(true);
    try {
      console.log(`🧪 [DebugShare] Testing social API for artist ID: ${artistId}`);
      const response = await fetch(`/api/artist-social/${artistId}`);
      const data = await response.json();
      console.log(`🧪 [DebugShare] API Response:`, data);
      setTestResults(data);
    } catch (error) {
      console.error(`🧪 [DebugShare] API Error:`, error);
      setTestResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const testNetworkApi = async (artistName: string) => {
    setLoading(true);
    try {
      console.log(`🧪 [DebugShare] Testing network API for artist: ${artistName}`);
      const response = await fetch(`/api/network/${encodeURIComponent(artistName)}`);
      const data = await response.json();
      console.log(`🧪 [DebugShare] Network API Response:`, data);
      
      if (data.nodes) {
        const mainArtist = data.nodes.find((node: any) => node.size === 30 && node.type === 'artist');
        console.log(`🧪 [DebugShare] Main artist from network:`, mainArtist);
        
        if (mainArtist?.artistId) {
          // Now test the social API with this artist ID
          await testSocialApi(mainArtist.artistId);
        } else {
          setTestResults({ error: 'No artist ID found in main artist node' });
        }
      } else {
        setTestResults({ error: 'No nodes in network response' });
      }
    } catch (error) {
      console.error(`🧪 [DebugShare] Network API Error:`, error);
      setTestResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-gray-900 p-4 rounded-lg border border-gray-600 max-w-sm">
      <h3 className="text-white text-sm font-bold mb-2">Social Media Debug</h3>
      
      <div className="space-y-2">
        <Button 
          size="sm" 
          onClick={() => testNetworkApi("Taylor Swift")}
          disabled={loading}
          className="w-full text-xs"
        >
          Test Taylor Swift Flow
        </Button>
        
        <Button 
          size="sm" 
          onClick={() => testSocialApi("1")}
          disabled={loading}
          className="w-full text-xs"
        >
          Test Direct API (ID: 1)
        </Button>
        
        <Button 
          size="sm" 
          onClick={() => testSocialApi("2")}
          disabled={loading}
          className="w-full text-xs"
        >
          Test Direct API (ID: 2)
        </Button>
      </div>
      
      {loading && <p className="text-yellow-400 text-xs mt-2">Testing...</p>}
      
      {testResults && (
        <div className="mt-2 text-xs text-white bg-black p-2 rounded max-h-32 overflow-y-auto">
          <pre>{JSON.stringify(testResults, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 