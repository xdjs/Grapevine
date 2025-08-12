## Goal

Separate the network generation into staged API calls so the UI can render incrementally:

- (1) User prompts an artist
- (2) Check database cache for existing web map
- (3) If not cached, generate a skeleton web from OpenAI (nodes and links only; no roles) and render immediately with placeholder white borders
- (4) Fetch roles in a separate OpenAI call and update node borders
- (5) Fetch profile pictures (cached or Spotify) and update node images

## Overview of Endpoints

- Skeleton generation (nodes-only):
  - GET `/api/network-skeleton/:artistName?allowHallucinations=false`
  - Returns `{ nodes, links, cached, metadata }` with no roles assigned

- Roles enrichment (batch):
  - POST `/api/network-roles`
  - Body: `{ names: string[] }`
  - Returns: `{ roles: Record<string, ("artist"|"producer"|"songwriter")[]> }`

- Profile pictures (existing):
  - POST `/api/artist-profile-pictures-batch`
  - Body: `{ artistNames: string[], useCache?: boolean }`
  - Returns existing structure with `imageUrl`, `spotifyId`, `cached` per artist

Notes:
- If full network is cached in `artists.webmapdata`, the skeleton endpoint should return it with `cached: true` and include any stored roles found in the cached data. The client can still run roles/pictures calls opportunistically, but should short-circuit if already present.
- No role colors are returned; the client computes border styles from the returned roles.

## Data Contracts

### 1) GET /api/network-skeleton/:artistName

Request
- Path params: `artistName` (URL-encoded)
- Query: `allowHallucinations` (optional, default `false`)

Response
```json
{
  "nodes": [
    { "id": "Taylor Swift", "name": "Taylor Swift", "size": 30, "artistId": 123 },
    { "id": "Jack Antonoff", "name": "Jack Antonoff", "size": 20, "artistId": 456 }
  ],
  "links": [
    { "source": "Taylor Swift", "target": "Jack Antonoff" }
  ],
  "cached": false,
  "metadata": {
    "rolesIncluded": false,
    "imagesIncluded": false
  }
}
```

Behavior
- Step A: Find existing artist in DB (normalize name), else 404 with guidance.
- Step B: If `artists.webmapdata` exists and has >1 nodes, return it immediately with `cached: true` and `metadata.rolesIncluded` inferred from data. If single-node cached and `allowHallucinations=false`, return special `{ noCollaborators: true, singleNodeNetwork }` structure.
- Step C (cache miss): Call OpenAI to generate collaborators but IGNORE any roles returned. Build nodes with `id`, `name`, `size`, `artistId?`, and links. Do not set `type`/`types`. Optionally store nodes+links in `artists.webmapdata` to accelerate future loads.

OpenAI prompt (skeleton)
- Ask for collaborators with `name` and `topCollaborators`. Explicitly instruct to omit roles or provide them in a separate field that will be ignored. Limit to 10 collaborators. Ensure valid JSON.

### 2) POST /api/network-roles

Request
```json
{ "names": ["Taylor Swift", "Jack Antonoff", "Aaron Dessner"] }
```

Response
```json
{
  "roles": {
    "Taylor Swift": ["artist", "songwriter"],
    "Jack Antonoff": ["artist", "producer", "songwriter"],
    "Aaron Dessner": ["artist", "producer", "songwriter"]
  }
}
```

Behavior
- Batch role detection in one OpenAI call (single prompt returning a JSON object mapping names to arrays of roles). Validate and filter to the allowed set: `artist|producer|songwriter`.
- Optional: Persist the main artist’s roles in cache for consistency, but do not mutate `webmapdata` structure at this step (roles are view-layer decorations).

OpenAI prompt (roles)
- Provide the list of names and require a JSON object `{ "Name": [roles...] }` with roles from the allowed set only. Temperature low (0–0.2).

### 3) POST /api/artist-profile-pictures-batch (existing)

Request
```json
{ "artistNames": ["Taylor Swift", "Jack Antonoff"], "useCache": true }
```

Response (existing)
```json
{
  "results": [
    { "artistName": "Taylor Swift", "imageUrl": "https://...jpg", "spotifyId": "...", "cached": true },
    { "artistName": "Jack Antonoff", "imageUrl": "https://...jpg", "spotifyId": "...", "cached": false }
  ],
  "totalRequested": 2,
  "totalFound": 2,
  "totalCached": 1,
  "processingTimeMs": 123
}
```

Behavior
- Uses DB cache first (`artists.node_pfp`, `spotify_id`), then Spotify batch lookup, then updates DB cache.

## Client Flow

1) User enters artist name
- UI triggers `GET /api/network-skeleton/:artistName`.
- If `{ noCollaborators: true }`, show the no-collaborators UX.
- Else render the network immediately:
  - Nodes: render with placeholder style (white border) since roles are not yet known.
  - Links: render normally.

2) Fetch roles in background
- Collect all node names and call `POST /api/network-roles`.
- On response, update each node’s visual border according to roles mapping:
  - artist: hot pink border `#FF69B4`
  - producer: blue violet border `#8A2BE2`
  - songwriter: dark turquoise border `#00CED1`
  - multi-role: follow existing blending rules in UI (e.g., artist+songwriter keeps artist color; producer+songwriter keeps producer color).

3) Fetch images in background
- Call `POST /api/artist-profile-pictures-batch` with all node names.
- Update nodes with returned `imageUrl` where available. Keep placeholders where missing.

4) Progressive UI states
- While roles are pending: white borders.
- After roles: colored borders.
- After images: image fills or avatars applied.

## Server Implementation Plan

1) New file: `api/network-skeleton/[artistName].ts`
- Clone the current `api/network/[artistName].ts` flow but:
  - On cache hit: return cached `webmapdata` and set `metadata.rolesIncluded` accordingly.
  - On cache miss: run OpenAI to get collaborators, build nodes+links without setting any `type`/`types` fields, and store minimal `webmapdata` (optional) to speed subsequent loads.
  - Do not attempt profile picture hydration here; images are handled by the batch pictures API.

2) New file: `api/network-roles/index.ts`
- Accept `POST { names: string[] }`.
- Build a single OpenAI prompt for batch role detection; parse strict JSON; filter roles to allowed set; return mapping.
- Add basic caching for main artist roles if desired (e.g., a simple `roles_cache` table later), but keep initial implementation stateless.

3) Reuse existing pictures batch endpoint
- No changes required; client just calls it after roles.

## Caching Strategy

- `artists.webmapdata`: Cache the network structure (nodes+links). It can include `types` if previously computed, but the skeleton endpoint must work even when roles are absent.
- `artists.node_pfp` and `artists.spotify_id`: Continue to cache images and Spotify IDs per artist.
- Client should treat cache as advisory: if `metadata.rolesIncluded=false`, it will still call `/api/network-roles`.

## Error Handling & Timeouts

- Skeleton endpoint
  - On DB connection error: 500 with message
  - On OpenAI error: return single-node network or a graceful 503 with retry-after hint

- Roles endpoint
  - Validate names list size (e.g., max 100). On OpenAI parse errors, return empty mapping and let client retain white borders.

- Pictures endpoint
  - Already handles cache and Spotify failures per-artist; client keeps placeholders on missing images.

## Client Integration Checklist

- Add a hook to orchestrate staged fetching:
  - Fetch skeleton → render
  - In parallel: fetch roles and pictures → update styles/imgs as responses arrive
- Ensure idempotent updates when data arrives in any order.
- Add visual loading cues for roles/images (e.g., subtle shimmer on borders until colored).

## Test Plan (high-level)

- Skeleton endpoint unit tests
  - Cache hit returns cached data with `cached: true`
  - Cache miss constructs nodes without roles and links are correct
  - Single-node no-collaborators path

- Roles endpoint unit tests
  - Valid batch request returns correct mapping
  - Invalid/extra roles are filtered out
  - Large inputs are rejected with 400

- Pictures batch (existing tests) + integration
  - Given node names, images are applied to nodes when available

- Client integration (component tests)
  - Renders skeleton with white borders, then updates to colored borders, then images
  - Idempotent updates if roles arrive before pictures and vice versa

## Rollout Notes

- Keep existing `GET /api/network/:artistName` and `GET /api/network-by-id/:artistId` for backward-compatibility during transition.
- Once the staged flow is stable, consider routing the main UI to the new skeleton+roles+images pipeline.


