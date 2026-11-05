# Guarded artist-query candidate for Music Nerd #1655

Local proposal against Grapevine main `e95621f17fc2ed142a600031d7f6cf8a59a2b0b6`. Not deployed, pushed or approved for production. No connection values were inspected and no provider endpoint was invoked.

## Proven consumer behavior

The Vercel API functions use `CONNECTION_STRING`; the Express database module prefers `DATABASE_URL` and falls back to `CONNECTION_STRING`. These can be different database roles. Tracked configuration names no role. Historical MusicNerdWeb issue #391 records Carl (`clt`) creating `webmapdata_editor` for Artist Web Map; this is historical attribution, not evidence of today's credential mapping.

The production-target Vercel deployment inspected for Grapevine reports this exact source commit. No available diagnostic returns the authenticated database role: `api/health.ts` only executes `SELECT 1`. An absence of active role sessions does not prove disuse. Do not call network/profile endpoints for diagnosis: cache misses can invoke providers and write data.

`api/search.ts` explicitly SELECTs and returns biography text in both search branches. This is an additional raw-bio consumer beyond the `SELECT *` ID lookup in `server/musicnerd-service.ts`. The latter only needs id/name.

## Local changes and test scope

All literal artist SELECTs in runtime API/server files use `mn_public.artists`; the ID lookup requests only id/name. Literal writes explicitly use `public.artists`, retaining their predicates and parameters. Cache column expressions remain unchanged. No fallback to raw biography reads, global search-path change, grant, or migration is included.

Run the provider-free query tests with Node 24 and an existing PGlite installation:

```
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node --test scripts/guarded-artist-queries.test.mjs
```

The four tests extract actual query literals from source, execute search before/after synthetic withdrawal, check ID reads and expose the baseline cache-column mismatch, exercise name/id network cache writes under a restricted role, and reject raw SELECT-star and broader writes. The small test view is a policy stand-in: these tests verify query routing, not the complete Music Nerd evidence policy, live authentication, or complete browser behavior. The separate MusicNerdAPI guarded projection tests cover full evidence policy, Dev/production RLS replicas and rollback. No new package dependency or lockfile is introduced.

## Compatibility limits that must not be silently widened

The existing profile-picture API read/write paths use `spotify_id`, absent from the pinned Music Nerd schema. A tempting SELECT alias to `spotify` was deliberately excluded after review: it would activate previously failing reads whose handlers return `node_pfp` directly as an image URL, while the Express writer stores a JSON object there. A separate compatibility repair must normalize both supported cache shapes before enabling those reads. The Express Drizzle artist model also expects a serial id and fields such as type, image_url and instagram_username which do not match Music Nerd's schema. Its `.select().from(artists)` and `.insert(artists).returning()` remain outside this literal-query proposal. These are baseline mismatches, not proof that the live API uses a different schema. They prevent claiming whole-app compatibility until the actual database target and active runtime are confirmed.

The proposed Music Nerd map grant permits only UPDATE(webmapdata). Profile-picture endpoints attempt node_pfp/spotify_id updates; Express also attempts INSERT and updated_at writes. Do not grant those abilities as a side effect of an About fix. Determine whether each presently works/is authorized before narrowing existing grants. This candidate does not repair or newly authorize them. Existing caught cache failures may still return provider results, masking database incompatibility.

## Minimal missing evidence and cutover order

Ask Pete or Carl for the **nonsecret result of `SELECT current_user, current_database()` using the deployed Grapevine API's existing CONNECTION_STRING**, and whether the Express server is independently deployed (if so, repeat through its selected connection). No password, URL, key, or new credentials are needed. A documented current deployment-to-role inventory is also sufficient. Do not infer the answer from an environment-variable name or historical issue.

1. Verify the actual role/database and the live profile-cache write contract; reconcile existing grants and inheritance without granting broader rights.
2. Install/rehearse the approved guarded relation and exact consumer grants with Music Nerd's evidence migrations. This app cannot deploy before the relation exists.
3. Coordinate Grapevine's guarded reads and Music Nerd API/Web cutover. Keep raw reads only during a bounded, explicitly controlled transition; do not activate restricted new About content while raw readers remain. A consumer-first rollout can be tested against the guarded view before removing raw privileges.
4. Verify the actual deployed role can search/read permitted biographies, sees no restricted biography after source withdrawal, and can perform only the intended cache writes with synthetic fixtures. No live test is authorized by this document.
5. Only then revoke identified raw-bio read paths. Unknown readers remain a release blocker. Do not restore an old raw-reading client after privilege cutover; use a compatible fixed client or the reviewed guarded NULL-bio fallback, preserving raw data and evidence.

The map may already cache downloaded content in browsers or intermediary systems; source withdrawal cannot retract a prior response. This proposal does not establish a cache invalidation policy.
