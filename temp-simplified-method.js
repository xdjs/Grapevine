  private async generateRealCollaborationNetwork(artistName: string): Promise<NetworkData> {
    const links: NetworkLink[] = [];
    const nodeMap = new Map<string, NetworkNode>();
    
    // Get MusicNerd URL for main artist
    const musicNerdBaseUrl = process.env.MUSIC_BASE_URL || process.env.MUSICNERD_BASE_URL || 'https://musicnerd.xyz';
    let musicNerdUrl = musicNerdBaseUrl;
    try {
      const artistId = await musicNerdService.getArtistId(artistName);
      if (artistId) {
        musicNerdUrl = `${musicNerdBaseUrl}/artist/${artistId}`;
      }
    } catch (error) {
      console.log(`📭 [DEBUG] No MusicNerd ID found for main artist ${artistName}`);
    }

    // Create main artist node
    const mainArtistNode: NetworkNode = {
      id: artistName,
      name: artistName,
      type: 'artist',
      types: ['artist'],
      size: 25,
      musicNerdUrl,
    };
    nodeMap.set(artistName, mainArtistNode);
    
    console.log(`🔍 [DEBUG] Starting collaboration network generation for: "${artistName}"`);
    console.log('📊 [DEBUG] Data source priority: 1) OpenAI → 2) MusicBrainz (no fallbacks)');

    try {
      // First try OpenAI for collaboration data
      if (openAIService.isServiceAvailable()) {
        console.log(`🤖 [DEBUG] Querying OpenAI API for "${artistName}"...`);
        
        try {
          const openAIData = await openAIService.getArtistCollaborations(artistName);
          console.log(`✅ [DEBUG] OpenAI response:`, {
            collaborators: openAIData.artists.length,
            collaboratorList: openAIData.artists.map(a => `${a.name} (${a.type}, top collaborators: ${a.topCollaborators.length})`)
          });

          if (openAIData.artists.length > 0) {
            // Process OpenAI data
            for (const collaborator of openAIData.artists) {
              // Get image from Spotify if available
              let imageUrl: string | null = null;
              let spotifyId: string | null = null;
              if (spotifyService.isConfigured()) {
                try {
                  const spotifyArtist = await spotifyService.searchArtist(collaborator.name);
                  if (spotifyArtist) {
                    imageUrl = spotifyService.getArtistImageUrl(spotifyArtist, 'medium');
                    spotifyId = spotifyArtist.id;
                  }
                } catch (error) {
                  console.log(`🔒 [DEBUG] Spotify search failed for "${collaborator.name}"`);
                }
              }

              const collaboratorNode = {
                id: collaborator.name,
                name: collaborator.name,
                type: collaborator.type,
                types: [collaborator.type],
                size: 15,
                imageUrl,
                spotifyId,
                collaborations: collaborator.topCollaborators || [],
              };

              // Get MusicNerd artist ID for the collaborator
              let musicNerdUrl = musicNerdBaseUrl;
              try {
                const artistId = await musicNerdService.getArtistId(collaborator.name);
                if (artistId) {
                  musicNerdUrl = `${musicNerdBaseUrl}/artist/${artistId}`;
                  console.log(`✅ [DEBUG] Found MusicNerd ID for ${collaborator.name}: ${artistId}`);
                }
              } catch (error) {
                console.log(`📭 [DEBUG] No MusicNerd ID found for ${collaborator.name}`);
              }

              collaboratorNode.musicNerdUrl = musicNerdUrl;
              nodeMap.set(collaborator.name, collaboratorNode);
            }

            // Process all nodes to create links and branching connections
            const allNodes = Array.from(nodeMap.values());
            const mainNode = nodeMap.get(artistName)!;
            
            for (const collaboratorNode of allNodes) {
              // Skip self-processing for the main artist
              if (collaboratorNode.name !== artistName) {
                // Create main connection to collaborator
                links.push({
                  source: mainNode.id,
                  target: collaboratorNode.id,
                });

                // Add branching connections for the top collaborators
                const maxBranching = 3;
                const branchingCount = Math.min(collaboratorNode.collaborations?.length || 0, maxBranching);
                
                for (let i = 0; i < branchingCount; i++) {
                  const branchingArtist = collaboratorNode.collaborations![i];
                  
                  // Check if this branching artist is already in our main node map
                  let branchingNode = nodeMap.get(branchingArtist);
                  
                  if (!branchingNode) {
                    branchingNode = {
                      id: branchingArtist,
                      name: branchingArtist,
                      type: 'artist',
                      types: ['artist'],
                      size: 15,
                    };

                    // Get MusicNerd ID for branching artist
                    let branchingMusicNerdUrl = musicNerdBaseUrl;
                    try {
                      const branchingArtistId = await musicNerdService.getArtistId(branchingArtist);
                      if (branchingArtistId) {
                        branchingMusicNerdUrl = `${musicNerdBaseUrl}/artist/${branchingArtistId}`;
                      }
                    } catch (error) {
                      console.log(`📭 [DEBUG] No MusicNerd ID found for branching artist ${branchingArtist}`);
                    }

                    branchingNode.musicNerdUrl = branchingMusicNerdUrl;
                    nodeMap.set(branchingArtist, branchingNode);
                  }
                  
                  // Create link between collaborator and their top collaborator
                  links.push({
                    source: collaboratorNode.name,
                    target: branchingArtist,
                  });

                  console.log(`🌟 [DEBUG] Added branching artist "${branchingArtist}" connected to "${collaboratorNode.name}"`);
                }

                console.log(`➕ [DEBUG] Added ${collaboratorNode.type}: ${collaboratorNode.name} from OpenAI with ${branchingCount} branching connections`);
              }
            }

            // Final node array from consolidated map
            const nodes = Array.from(nodeMap.values());
            console.log(`✅ [DEBUG] Successfully created network from OpenAI data: ${nodes.length} total nodes for "${artistName}"`);
            
            // Cache the generated network data
            const finalNetworkData = { nodes, links };
            console.log(`💾 [DEBUG] About to cache OpenAI network data for "${artistName}" with ${nodes.length} nodes`);
            await this.cacheNetworkData(artistName, finalNetworkData);
            
            return finalNetworkData;
          }
        } catch (error) {
          console.error(`❌ [DEBUG] OpenAI API error for "${artistName}":`, error);
          console.log('🔄 [DEBUG] Falling back to MusicBrainz...');
        }
      } else {
        console.log('⚠️ [DEBUG] OpenAI service not available, falling back to MusicBrainz...');
      }

      // Fallback to MusicBrainz if OpenAI fails or isn't available
      console.log(`🎵 [DEBUG] Querying MusicBrainz API for "${artistName}"...`);
      const collaborationData = await musicBrainzService.getArtistCollaborations(artistName);
      console.log(`✅ [DEBUG] MusicBrainz response:`, {
        artists: collaborationData.artists.length,
        works: collaborationData.works.length,
        artistList: collaborationData.artists.map(a => `${a.name} (${a.type}, relation: ${a.relation})`),
        worksList: collaborationData.works.map(w => `${w.title} with [${w.collaborators.join(', ')}]`)
      });
      
      // Get Spotify image for main artist
      let mainArtistImage = null;
      let mainArtistSpotifyId = null;
      
      if (spotifyService.isConfigured()) {
        try {
          const spotifyArtist = await spotifyService.searchArtist(artistName);
          if (spotifyArtist) {
            mainArtistImage = spotifyService.getArtistImageUrl(spotifyArtist, 'medium');
            mainArtistSpotifyId = spotifyArtist.id;
          }
        } catch (error) {
          console.warn(`Could not fetch Spotify data for ${artistName}`);
        }
      }

      // Get MusicNerd artist ID for main artist
      let mainArtistMusicNerdId = null;
      try {
        mainArtistMusicNerdId = await musicNerdService.getArtistId(artistName);
      } catch (error) {
        console.log(`Could not fetch MusicNerd ID for ${artistName}`);
      }

      // Update main artist node with additional data
      const mainArtistNode = nodeMap.get(artistName)!;
      mainArtistNode.imageUrl = mainArtistImage;
      mainArtistNode.spotifyId = mainArtistSpotifyId;
      mainArtistNode.artistId = mainArtistMusicNerdId;

      // Add collaborating artists from MusicBrainz - limit to top 5 producers and songwriters for performance
      console.log(`🎨 [DEBUG] Processing ${collaborationData.artists.length} MusicBrainz collaborators...`);
      
      // Separate collaborators by type and limit producers/songwriters to top 5 each
      const artists = collaborationData.artists.filter(c => c.type === 'artist');
      const producers = collaborationData.artists.filter(c => c.type === 'producer').slice(0, 5);
      const songwriters = collaborationData.artists.filter(c => c.type === 'songwriter').slice(0, 5);
      
      const limitedCollaborators = [...artists, ...producers, ...songwriters];
      console.log(`⚡ [DEBUG] Limited to ${limitedCollaborators.length} collaborators (${producers.length} producers, ${songwriters.length} songwriters, ${artists.length} artists)`);
      
      for (const collaborator of limitedCollaborators) {
        console.log(`👤 [DEBUG] Processing collaborator: "${collaborator.name}" (type: ${collaborator.type}, relation: ${collaborator.relation})`);
        
        // Get Spotify image for collaborator
        let collaboratorImage = null;
        let collaboratorSpotifyId = null;
        
        if (spotifyService.isConfigured()) {
          try {
            const spotifyCollaborator = await spotifyService.searchArtist(collaborator.name);
            if (spotifyCollaborator) {
              collaboratorImage = spotifyService.getArtistImageUrl(spotifyCollaborator, 'medium');
              collaboratorSpotifyId = spotifyCollaborator.id;
            }
          } catch (error) {
            console.log(`⚠️ [DEBUG] Spotify lookup failed for "${collaborator.name}"`);
          }
        }

        // Get MusicNerd artist ID for collaborators who are artists
        let collaboratorMusicNerdId = null;
        if (collaborator.type === 'artist') {
          try {
            collaboratorMusicNerdId = await musicNerdService.getArtistId(collaborator.name);
          } catch (error) {
            console.log(`Could not fetch MusicNerd ID for ${collaborator.name}`);
          }
        }

        const collaboratorNode = {
          id: collaborator.name,
          name: collaborator.name,
          type: collaborator.type as 'artist' | 'producer' | 'songwriter',
          types: [collaborator.type as 'artist' | 'producer' | 'songwriter'],
          size: 15,
          imageUrl: collaboratorImage,
          spotifyId: collaboratorSpotifyId,
          artistId: collaboratorMusicNerdId,
        };
        nodeMap.set(collaborator.name, collaboratorNode);
        
        console.log(`➕ [DEBUG] Added node: "${collaborator.name}" (${collaborator.type}) from MusicBrainz`);

        links.push({
          source: artistName,
          target: collaborator.name,
        });
        console.log(`🔗 [DEBUG] Created link: "${artistName}" ↔ "${collaborator.name}"`);
      }

      // If no collaborations found from either source, return only main artist
      if (collaborationData.artists.length === 0) {
        console.log(`👤 [DEBUG] No collaborations found for "${artistName}" - returning main artist only`);
      }

      // Final node array from consolidated map
      const nodes = Array.from(nodeMap.values());
      
      // Cache the generated network data
      const networkData = { nodes, links };
      console.log(`💾 [DEBUG] About to cache MusicBrainz network data for "${artistName}" with ${nodes.length} nodes`);
      await this.cacheNetworkData(artistName, networkData);
      
      return networkData;

    } catch (error) {
      console.error(`❌ [DEBUG] Error in generateRealCollaborationNetwork for "${artistName}":`, error);
      throw error;
    }
  }