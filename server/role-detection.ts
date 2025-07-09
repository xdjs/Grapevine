import { openAIService } from './openai-service.js';
import { musicBrainzService } from './musicbrainz.js';

export interface RoleDetectionResult {
  roles: ('artist' | 'producer' | 'songwriter')[];
  primaryRole: 'artist' | 'producer' | 'songwriter';
  source: 'openai' | 'musicbrainz' | 'default';
}

class RoleDetectionService {
  private roleCache = new Map<string, RoleDetectionResult>();

  /**
   * Get verified roles for any artist from authentic data sources
   * This ensures role consistency whether they're a main artist or collaborator
   */
  async getVerifiedRoles(artistName: string): Promise<RoleDetectionResult> {
    // Check cache first
    const cached = this.roleCache.get(artistName.toLowerCase());
    if (cached) {
      console.log(`🎭 [RoleDetection] Using cached roles for "${artistName}":`, cached.roles);
      return cached;
    }

    const roles: Set<'artist' | 'producer' | 'songwriter'> = new Set();
    let source: 'openai' | 'musicbrainz' | 'default' = 'default';

    // Try OpenAI first for role detection
    if (openAIService.isServiceAvailable()) {
      try {
        console.log(`🤖 [RoleDetection] Querying OpenAI for roles of "${artistName}"`);
        const openAIData = await openAIService.getArtistCollaborations(artistName);
        
        // If this person appears in their own collaboration data, use those roles
        const selfEntry = openAIData.artists.find(a => a.name.toLowerCase() === artistName.toLowerCase());
        if (selfEntry) {
          roles.add(selfEntry.type);
          source = 'openai';
          console.log(`✅ [RoleDetection] OpenAI found "${artistName}" as ${selfEntry.type}`);
        }

        // Also check if they appear as a collaborator in their own network
        // This can reveal multiple roles (e.g., artist who also produces/writes)
        const collaboratorRoles = openAIData.artists
          .filter(a => a.name.toLowerCase() === artistName.toLowerCase())
          .map(a => a.type);
        
        collaboratorRoles.forEach(role => roles.add(role));
        
        if (collaboratorRoles.length > 0) {
          source = 'openai';
          console.log(`✅ [RoleDetection] OpenAI detected multiple roles for "${artistName}":`, collaboratorRoles);
        }
      } catch (error) {
        console.log(`⚠️ [RoleDetection] OpenAI failed for "${artistName}":`, error);
      }
    }

    // Try MusicBrainz as fallback
    if (roles.size === 0) {
      try {
        console.log(`🎵 [RoleDetection] Querying MusicBrainz for roles of "${artistName}"`);
        const mbData = await musicBrainzService.getArtistCollaborations(artistName);
        
        // Check if this person appears in their own collaboration data
        const selfEntry = mbData.artists.find(a => a.name.toLowerCase() === artistName.toLowerCase());
        if (selfEntry) {
          roles.add(selfEntry.type);
          source = 'musicbrainz';
          console.log(`✅ [RoleDetection] MusicBrainz found "${artistName}" as ${selfEntry.type}`);
        }
      } catch (error) {
        console.log(`⚠️ [RoleDetection] MusicBrainz failed for "${artistName}":`, error);
      }
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

    // Cache the result
    this.roleCache.set(artistName.toLowerCase(), result);
    console.log(`🎭 [RoleDetection] Cached roles for "${artistName}":`, result);

    return result;
  }

  /**
   * Get roles for a person when they appear as a collaborator
   * This should match their main artist roles for consistency
   */
  async getCollaboratorRoles(collaboratorName: string, contextRole: 'artist' | 'producer' | 'songwriter'): Promise<RoleDetectionResult> {
    // Check cache first for performance
    const cached = this.roleCache.get(collaboratorName.toLowerCase());
    if (cached) {
      console.log(`🎭 [RoleDetection] Using cached collaborator roles for "${collaboratorName}":`, cached.roles);
      return cached;
    }

    // For collaborators, use a lighter approach to avoid excessive API calls
    // We'll use the OpenAI context role but cache it for consistency
    const result: RoleDetectionResult = {
      roles: [contextRole],
      primaryRole: contextRole,
      source: 'openai'
    };

    // Cache the result for consistency
    this.roleCache.set(collaboratorName.toLowerCase(), result);
    console.log(`🎭 [RoleDetection] Cached collaborator roles for "${collaboratorName}":`, result.roles);
    
    return result;
  }

  /**
   * Clear cache for testing or when roles might have changed
   */
  clearCache(): void {
    this.roleCache.clear();
    console.log('🧹 [RoleDetection] Cache cleared');
  }
}

export const roleDetectionService = new RoleDetectionService();