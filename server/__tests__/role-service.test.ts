import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../musicbrainz.js', () => ({
	musicBrainzService: {
		getArtistCollaborations: vi.fn(async (name: string) => {
			if (name === 'Pharrell Williams') {
				return {
					artists: [
						{ name: 'Daft Punk', type: 'artist', relation: 'featured artist' },
						{ name: 'Chad Hugo', type: 'producer', relation: 'producer' },
					],
					works: [ { title: 'Happy', collaborators: ['Pharrell Williams'] } ]
				};
			}
			if (name === 'Max Martin') {
				return { artists: [{ name: 'Taylor Swift', type: 'songwriter', relation: 'composer' }], works: [ { title: 'Shake It Off', collaborators: ['Max Martin'] } ] };
			}
			return { artists: [], works: [] };
		})
	}
}));

vi.mock('../wikidata.js', () => ({
    wikidataService: {
        getOccupationalRoles: vi.fn(async (name: string) => {
            if (name === 'Pharrell Williams') {
                return { roles: ['producer', 'artist', 'songwriter'], occupationLabels: ['record producer', 'singer', 'songwriter'] };
            }
            if (name === 'Max Martin') {
                return { roles: ['producer', 'songwriter'], occupationLabels: ['record producer', 'songwriter'] };
            }
            return { roles: [], occupationLabels: [] };
        })
    }
}));

import { roleService } from '../role-service.js';

describe('roleService.computeRoles', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('combines MusicBrainz and Wikidata into roles with preference for evidence', async () => {
		const result = await roleService.computeRoles('Pharrell Williams', { includeArtistByDefault: true });
		expect(result.roles).toEqual(expect.arrayContaining(['artist', 'producer', 'songwriter']));
	});

	it('falls back to artist by default when no evidence found', async () => {
		const result = await roleService.computeRoles('Some Unknown Person', { includeArtistByDefault: true });
		expect(result.roles).toContain('artist');
	});

	it('returns songwriter when MusicBrainz works indicate songwriting', async () => {
		const result = await roleService.computeRoles('Max Martin', { includeArtistByDefault: false });
		expect(result.roles).toEqual(expect.arrayContaining(['songwriter', 'producer']));
	});
});


