import 'dotenv/config';
import { musicBrainzService } from './musicbrainz.js';
import { wikidataService, RoleType as WikiRoleType } from './wikidata.js';

export type RoleType = 'artist' | 'producer' | 'songwriter';

export interface RoleEvidence {
	source: 'musicbrainz' | 'wikidata' | 'discogs' | 'wikipedia' | 'ai_inferred';
	items?: Array<{ id?: string; title?: string; relation?: string }>;
	labels?: string[]; // for wikidata occupations
}

export interface ComputedRolesResult {
	roles: RoleType[];
	evidence: Record<RoleType, RoleEvidence[]>;
}

function normalizeRoles(input: string[]): RoleType[] {
	const set = new Set<RoleType>();
	for (const role of input) {
		const lower = role.toLowerCase();
		if (lower === 'artist' || lower === 'producer' || lower === 'songwriter') set.add(lower);
	}
	return Array.from(set);
}

function mergeEvidence(target: Record<RoleType, RoleEvidence[]>, role: RoleType, evidence: RoleEvidence) {
	if (!target[role]) target[role] = [];
	target[role].push(evidence);
}

export class RoleService {
	// Compute roles using MusicBrainz credits + Wikidata occupations. AI should be used by callers only as last resort.
	async computeRoles(personName: string, options?: { includeArtistByDefault?: boolean }): Promise<ComputedRolesResult> {
		const includeArtistByDefault = options?.includeArtistByDefault ?? true;
		const evidence: Record<RoleType, RoleEvidence[]> = { artist: [], producer: [], songwriter: [] };

		// 1) MusicBrainz: analyze relations and recordings
		const mbData = await musicBrainzService.getArtistCollaborations(personName);
		const mbCounts: Record<RoleType, { count: number; items: Array<{ title?: string; relation?: string }> }> = {
			artist: { count: 0, items: [] },
			producer: { count: 0, items: [] },
			songwriter: { count: 0, items: [] },
		};
		for (const a of mbData.artists) {
			const r = a.type as RoleType;
			if (r === 'artist' || r === 'producer' || r === 'songwriter') {
				mbCounts[r].count += 1;
				mbCounts[r].items.push({ relation: a.relation });
			}
		}
		for (const w of mbData.works) {
			// presence of works with collaborators implies songwriting involvement for the subject
			mbCounts.songwriter.count += 1;
			mbCounts.songwriter.items.push({ title: w.title, relation: 'work' });
		}
		const mbRoles: RoleType[] = [];
		if (mbCounts.artist.count >= 1) mbRoles.push('artist');
		if (mbCounts.producer.count >= 1) mbRoles.push('producer');
		if (mbCounts.songwriter.count >= 1) mbRoles.push('songwriter');
		for (const role of mbRoles) {
			mergeEvidence(evidence, role, { source: 'musicbrainz', items: mbCounts[role].items.slice(0, 5) });
		}

		// 2) Wikidata occupations as structured supplement
		const wd = await wikidataService.getOccupationalRoles(personName);
		if (wd && wd.roles.length > 0) {
			for (const role of normalizeRoles(wd.roles as WikiRoleType[] as string[])) {
				mergeEvidence(evidence, role, { source: 'wikidata', labels: wd.occupationLabels });
			}
		}

		// Merge roles with weighting: MB > Wikidata; ensure uniqueness
		const roleSet = new Set<RoleType>();
		for (const r of mbRoles) roleSet.add(r);
		if (wd) for (const r of normalizeRoles(wd.roles as string[])) roleSet.add(r);

		// Optional default artist role if nothing was found
		if (roleSet.size === 0 && includeArtistByDefault) roleSet.add('artist');

		const roles = Array.from(roleSet);
		return { roles, evidence };
	}
}

export const roleService = new RoleService();


