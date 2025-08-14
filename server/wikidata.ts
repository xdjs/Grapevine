import 'dotenv/config';

export type RoleType = 'artist' | 'producer' | 'songwriter';

interface WikidataSearchResult {
	search: Array<{
		id: string;
		label?: string;
		description?: string;
	}>;
}

interface WikidataEntitiesResult {
	entities: Record<string, {
		claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>>
	}>;
}

interface WikidataLabelsResult {
	entities: Record<string, {
		labels?: Record<string, { value: string }>
	}>;
}

class WikidataService {
	private baseUrl = 'https://www.wikidata.org/w/api.php';

	private async fetchJson<T>(url: string): Promise<T> {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Grapevine/1.0 (https://github.com/grapevine-music)'
			}
		});
		if (!response.ok) {
			throw new Error(`Wikidata API error: ${response.status}`);
		}
		return response.json() as Promise<T>;
	}

	private async searchEntityIdByName(personName: string): Promise<string | null> {
		const url = `${this.baseUrl}?action=wbsearchentities&language=en&format=json&search=${encodeURIComponent(personName)}&type=item&origin=*`;
		try {
			const result = await this.fetchJson<WikidataSearchResult>(url);
			return result.search?.[0]?.id || null;
		} catch {
			return null;
		}
	}

	private async getOccupationIds(entityId: string): Promise<string[]> {
		const url = `${this.baseUrl}?action=wbgetentities&ids=${entityId}&props=claims&format=json&origin=*`;
		try {
			const result = await this.fetchJson<WikidataEntitiesResult>(url);
			const entity = result.entities?.[entityId];
			const p106 = entity?.claims?.['P106'] || [];
			const ids: string[] = [];
			for (const claim of p106) {
				const id = claim?.mainsnak?.datavalue?.value?.id;
				if (id) ids.push(id);
			}
			return ids;
		} catch {
			return [];
		}
	}

	private async getLabelsForIds(ids: string[]): Promise<Map<string, string>> {
		if (ids.length === 0) return new Map();
		const chunkSize = 50;
		const labelMap = new Map<string, string>();
		for (let i = 0; i < ids.length; i += chunkSize) {
			const chunk = ids.slice(i, i + chunkSize);
			const url = `${this.baseUrl}?action=wbgetentities&ids=${chunk.join('|')}&props=labels&languages=en&format=json&origin=*`;
			try {
				const result = await this.fetchJson<WikidataLabelsResult>(url);
				for (const [id, entity] of Object.entries(result.entities || {})) {
					const label = entity.labels?.['en']?.value;
					if (label) labelMap.set(id, label);
				}
			} catch {
				// ignore chunk errors
			}
		}
		return labelMap;
	}

	private mapOccupationLabelsToRoles(labels: string[]): RoleType[] {
		const roles = new Set<RoleType>();
		for (const label of labels) {
			const lower = label.toLowerCase();
			if (lower.includes('record producer') || lower.includes('music producer') || lower.includes('producer')) {
				roles.add('producer');
			}
			if (lower.includes('songwriter') || lower.includes('lyricist') || lower.includes('composer')) {
				roles.add('songwriter');
			}
			if (lower.includes('singer') || lower.includes('rapper') || lower.includes('musician') || lower.includes('vocalist') || lower.includes('artist') || lower.includes('performer')) {
				roles.add('artist');
			}
		}
		return Array.from(roles);
	}

	async getOccupationalRoles(personName: string): Promise<{ roles: RoleType[]; occupationLabels: string[] } | null> {
		try {
			const id = await this.searchEntityIdByName(personName);
			if (!id) return null;
			const occupationIds = await this.getOccupationIds(id);
			const labelMap = await this.getLabelsForIds(occupationIds);
			const labels = Array.from(labelMap.values());
			return { roles: this.mapOccupationLabelsToRoles(labels), occupationLabels: labels };
		} catch {
			return null;
		}
	}
}

export const wikidataService = new WikidataService();


