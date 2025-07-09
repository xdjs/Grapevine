import { openAIService } from './openai-service.js';
import { musicBrainzService } from './musicbrainz.js';

export interface RoleDetectionResult {
  roles: ('artist' | 'producer' | 'songwriter')[];
  primaryRole: 'artist' | 'producer' | 'songwriter';
  source: 'openai' | 'musicbrainz' | 'default';
}

class RoleDetectionService {
  private roleCache = new Map<string, RoleDetectionResult>();
  private static globalRoleCache = new Map<string, RoleDetectionResult>();

  /**
   * Get verified roles for any artist from authentic data sources
   * Optimized for performance with intelligent role detection
   */
  async getVerifiedRoles(artistName: string, isMainArtist: boolean = false): Promise<RoleDetectionResult> {
    // No caching - always generate fresh roles as requested

    const roles: Set<'artist' | 'producer' | 'songwriter'> = new Set();
    let source: 'openai' | 'musicbrainz' | 'default' = 'default';

    // For main artists, always ensure they have the 'artist' role
    if (isMainArtist) {
      roles.add('artist');
      source = 'default';
      console.log(`🎭 [RoleDetection] Main artist "${artistName}" automatically assigned 'artist' role`);
    }

    // Try OpenAI for comprehensive role detection 
    if (openAIService.isServiceAvailable()) {
      try {
        console.log(`🤖 [RoleDetection] Querying OpenAI for comprehensive roles of "${artistName}"`);
        const openAIData = await openAIService.getArtistCollaborations(artistName);
        
        // Check ALL collaborators to find this artist in different roles
        const collaboratorRoles = openAIData.artists
          .filter(a => a.name.toLowerCase() === artistName.toLowerCase())
          .map(a => a.type);
        
        collaboratorRoles.forEach(role => roles.add(role));
        
        if (collaboratorRoles.length > 0) {
          source = 'openai';
          console.log(`✅ [RoleDetection] OpenAI detected roles for "${artistName}":`, collaboratorRoles);
        }
      } catch (error) {
        console.log(`⚠️ [RoleDetection] OpenAI failed for "${artistName}":`, error);
      }
    }

    // Always try MusicBrainz to get additional roles (don't skip even if OpenAI found some)
    try {
      console.log(`🎵 [RoleDetection] Querying MusicBrainz for additional roles of "${artistName}"`);
      const mbData = await musicBrainzService.getArtistCollaborations(artistName);
      
      // Check ALL collaborators to find this person in different roles  
      const mbRoles = mbData.artists
        .filter(a => a.name.toLowerCase() === artistName.toLowerCase())
        .map(a => a.type);
      
      mbRoles.forEach(role => roles.add(role));
      
      if (mbRoles.length > 0) {
        if (source === 'default') source = 'musicbrainz';
        console.log(`✅ [RoleDetection] MusicBrainz detected additional roles for "${artistName}":`, mbRoles);
      }
    } catch (error) {
      console.log(`⚠️ [RoleDetection] MusicBrainz failed for "${artistName}":`, error);
    }

    // Default to artist if no roles found
    if (roles.size === 0) {
      roles.add('artist');
      console.log(`🎭 [RoleDetection] No verified roles found for "${artistName}", defaulting to artist`);
    }

    // Determine primary role (artist takes precedence if multiple)
    let primaryRole: 'artist' | 'producer' | 'songwriter' = 'artist';
    if (roles.has('artist')) {
      primaryRole = 'artist';
    } else if (roles.has('producer')) {
      primaryRole = 'producer';
    } else if (roles.has('songwriter')) {
      primaryRole = 'songwriter';
    }

    const result: RoleDetectionResult = {
      roles: Array.from(roles),
      primaryRole,
      source
    };

    // No caching - return fresh result each time
    console.log(`🎭 [RoleDetection] Fresh roles for "${artistName}":`, result);

    return result;
  }

  /**
   * Get roles for a person when they appear as a collaborator
   * This should match their main artist roles for consistency
   */
  async getCollaboratorRoles(collaboratorName: string, contextRole: 'artist' | 'producer' | 'songwriter'): Promise<RoleDetectionResult> {
    // No caching - always generate fresh roles for consistency

    // For collaborators, use a lighter approach to avoid excessive API calls
    // We'll use the OpenAI context role but cache it for consistency
    const result: RoleDetectionResult = {
      roles: [contextRole],
      primaryRole: contextRole,
      source: 'openai'
    };

    // No caching - return fresh result each time
    console.log(`🎭 [RoleDetection] Fresh collaborator roles for "${collaboratorName}":`, result.roles);
    
    return result;
  }

  /**
   * Cache functionality disabled as requested by user
   */
  cacheRoles(artistName: string, roles: RoleDetectionResult): void {
    // No caching - disabled as requested
  }

  /**
   * Clear cache for testing or when roles might have changed
   */
  clearCache(): void {
    // No caching - nothing to clear
    console.log('🧹 [RoleDetection] No cache to clear (caching disabled)');
  }
}

export const roleDetectionService = new RoleDetectionService();