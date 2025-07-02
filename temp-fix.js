// Temp fix for openMusicNerdProfile function
async function openMusicNerdProfile(artistName, artistId) {
  console.log(`🎵 [Frontend] openMusicNerdProfile called for "${artistName}" with artistId: ${artistId}`);
  
  // If we already have an artistId, skip the lookup and go directly to the page
  if (artistId) {
    console.log(`🎵 [Frontend] artistId provided (${artistId}), skipping lookup and going directly to page`);
  } else {
    // If no specific artist ID provided, check for multiple options
    console.log(`🎵 [Frontend] No artistId provided, checking for multiple options`);
    
    try {
      const response = await fetch(`/api/artist-options/${encodeURIComponent(artistName)}`);
      const data = await response.json();
      
      if (data.options && data.options.length > 1) {
        // Multiple artists found - show selection modal
        console.log(`🎵 Multiple artists found for "${artistName}", showing selection modal`);
        setSelectedArtistName(artistName);
        setShowArtistModal(true);
        return;
      } else if (data.options && data.options.length === 1) {
        // Single artist found - use its ID
        artistId = data.options[0].id;
        console.log(`🎵 Single artist found for "${artistName}": ${artistId}`);
      }
    } catch (error) {
      console.error(`Error fetching artist options for "${artistName}":`, error);
    }
  }
  
  // Check if base URL is available, fetch it if not
  let baseUrl = musicNerdBaseUrl;
  if (!baseUrl) {
    try {
      console.log('🔧 [Config] Base URL not cached, fetching config...');
      const configResponse = await fetch('/api/config');
      if (configResponse.ok) {
        const config = await configResponse.json();
        baseUrl = config.musicNerdBaseUrl;
        setMusicNerdBaseUrl(baseUrl); // Update state for future use
        console.log(`🔧 [Config] Fetched base URL: ${baseUrl}`);
      }
    } catch (error) {
      console.error('🔧 [Config] Error fetching config:', error);
    }
  }
  
  if (!baseUrl) {
    console.error(`🎵 Cannot open MusicNerd profile for "${artistName}": Base URL not configured`);
    return;
  }
  
  // Use artist ID if available, otherwise go to main page
  let musicNerdUrl = baseUrl;
  
  if (artistId) {
    musicNerdUrl = `${baseUrl}/artist/${artistId}`;
    console.log(`🎵 Opening MusicNerd artist page for "${artistName}": ${musicNerdUrl}`);
  } else {
    console.log(`🎵 No artist ID found for "${artistName}", opening main MusicNerd page`);
  }
  
  // Try multiple approaches to open the link
  try {
    // Method 1: window.open (most reliable for user-initiated actions)
    const newWindow = window.open(musicNerdUrl, '_blank', 'noopener,noreferrer');
    
    // Method 2: Fallback to link click if window.open blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
      console.log('🎵 Window.open blocked, trying link click method...');
      const link = document.createElement('a');
      link.href = musicNerdUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.log('🎵 Successfully opened new window');
    }
  } catch (error) {
    console.error('🎵 Error opening MusicNerd page:', error);
    // Final fallback: copy URL to clipboard and notify user
    if (navigator.clipboard) {
      navigator.clipboard.writeText(musicNerdUrl).then(() => {
        alert(`Unable to open page automatically. URL copied to clipboard: ${musicNerdUrl}`);
      }).catch(() => {
        alert(`Please visit: ${musicNerdUrl}`);
      });
    } else {
      alert(`Please visit: ${musicNerdUrl}`);
    }
  }
}