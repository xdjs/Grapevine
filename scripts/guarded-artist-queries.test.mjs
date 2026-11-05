// Provider-free contract tests. Supply an installed PGlite module via PGLITE_MODULE.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
const root = new URL('../', import.meta.url);
const source = path => readFileSync(new URL(path, root), 'utf8');
const literal = (path, name) => {
  const match = source(path).match(new RegExp(`const ${name} = (['\x60])([\\s\\S]*?)\\1;`));
  assert.ok(match, `${path}: ${name} SQL literal`);
  return match[2];
};
const { PGlite } = await import(process.env.PGLITE_MODULE
  ? pathToFileURL(resolve(process.env.PGLITE_MODULE)).href : '@electric-sql/pglite');
const pg = new PGlite();
// A small policy stand-in tests consumer routing; MusicNerd's projection suite
// separately tests the full evidence/withdrawal policy and production role shape.
await pg.exec(`
 CREATE ROLE map_reader;
 CREATE TABLE public.artists(id uuid PRIMARY KEY,name text,bio text,webmapdata jsonb,spotify text,node_pfp text);
 INSERT INTO public.artists VALUES('00000000-0000-4000-8000-000000000001','Synthetic Artist','Synthetic biography','{}','synthetic-id','synthetic-image');
 CREATE TABLE public.visibility(visible boolean);
 INSERT INTO public.visibility VALUES(true);
 CREATE SCHEMA mn_public;
 CREATE VIEW mn_public.artists AS SELECT id,name,CASE WHEN (SELECT visible FROM public.visibility) THEN bio END AS bio,webmapdata,spotify,node_pfp FROM public.artists;
 GRANT USAGE ON SCHEMA mn_public TO map_reader;
 GRANT SELECT ON mn_public.artists TO map_reader;
 GRANT SELECT(id,name,webmapdata),UPDATE(webmapdata) ON public.artists TO map_reader;
`);
const asReader = async fn => {
  await pg.exec('SET ROLE map_reader');
  try { return await fn(); } finally { await pg.exec('RESET ROLE'); }
};
try {
  await test('actual search SQL returns guarded bio and observes withdrawal on next read', async () => {
    const queries = [...source('api/search.ts').matchAll(/searchQuery = `([\s\S]*?)`;/g)].map(m => m[1]);
    assert.equal(queries.length, 2);
    for (const [index, query] of queries.entries()) {
      const args = index === 0 ? ['S%', 'S%'] : ['%Synthetic%', 'Synthetic%', '%Synthetic', 'Synthetic', 'Synthetic%', '%Synthetic%'];
      const before = await asReader(() => pg.query(query, args));
      assert.equal(before.rows[0].bio, 'Synthetic biography');
      await pg.exec('UPDATE visibility SET visible=false');
      const after = await asReader(() => pg.query(query, args));
      assert.equal(after.rows[0].bio, null);
      await pg.exec('UPDATE visibility SET visible=true');
    }
  });
  await test('actual id/name reads work; baseline cache schema mismatch remains explicit', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const lookup = literal('server/musicnerd-service.ts', 'query');
    const found = await asReader(() => pg.query(lookup, ['synthetic artist']));
    assert.deepEqual(Object.keys(found.rows[0]).sort(), ['id', 'name']);
    const byId = literal('api/network-by-id/[artistId].ts', 'artistQuery');
    assert.equal((await asReader(() => pg.query(byId, [id]))).rows[0].id, id);
    const cache = literal('api/network/[artistName].ts', 'cacheQuery');
    await assert.rejects(asReader(() => pg.query(cache, [id])), /column \"spotify_id\" does not exist/);
    await assert.rejects(asReader(() => pg.query('SELECT * FROM public.artists')), /permission denied/);
  });
  await test('actual name and id cache writes retain base-table behavior without wider writes', async () => {
    for (const [path, key] of [['api/network/[artistName].ts', 'synthetic artist'], ['api/network-by-id/[artistId].ts', '00000000-0000-4000-8000-000000000001']]) {
      const sql = literal(path, 'updateQuery');
      const result = await asReader(() => pg.query(sql, [JSON.stringify({ synthetic: true }), key]));
      assert.equal(result.affectedRows, 1);
    }
    await assert.rejects(asReader(() => pg.exec("UPDATE public.artists SET bio='changed'")), /permission denied/);
    await assert.rejects(asReader(() => pg.exec("UPDATE mn_public.artists SET webmapdata='{}'")), /permission denied/);
  });
  await test('all runtime literal artist reads are guarded; raw writes are explicitly qualified', () => {
    const walk = dir => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
    for (const path of [...walk('api'), ...walk('server')].filter(p => p.endsWith('.ts') && !p.includes('__tests__') && !p.endsWith('.test.ts'))) {
      assert.doesNotMatch(source(path), /\bFROM (?:public\.)?artists\b/i, path);
      assert.doesNotMatch(source(path), /\b(?:UPDATE|INSERT INTO) artists\b/i, path);
    }
  });
} finally {
  await pg.close();
}
