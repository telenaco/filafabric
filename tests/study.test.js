import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sanitizeStudyRecord, STUDY_NOTICE_VERSION } from '../src/engine/study-record.js';

test('study records retain the brim run count, including disabled brim', () => {
  for (const brim of [0, 2, 10]) {
    const raw = valid();
    raw.properties.print = { brim };
    assert.equal(sanitizeStudyRecord(raw).properties.print.brim, brim);
  }
});
import { createStudyRecorder } from '../src/ui/study.js';
import { onRequest } from '../functions/api/study/exports.js';
import { onRequestGet } from '../functions/api/study/status.js';

const origin = 'https://filafabric.pages.dev';
const id = 'abcde123-1234-4234-8234-123456789abc';
const valid = () => ({
  noticeVersion: STUDY_NOTICE_VERSION, eventId: id, design: 'squiggle', exportType: 'gcode-swatch',
  dimensions: { width: 60, height: 40 },
  properties: { settings: { pattern: 'waves', spacing: 3, backing: true }, print: { layerHeight: 0.2 } },
});
const request = (body = JSON.stringify(valid()), headers = {}) => new Request(`${origin}/api/study/exports`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body,
});

// D1's prepared statement boundary backed by real SQLite: migration, binding and conflict behavior execute together.
function database(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../migrations/0001_study_exports.sql', import.meta.url), 'utf8'));
  return {
    db,
    env: { STUDY_ENABLED: 'true', STUDY_DB: { prepare: (sql) => ({ bind: (...values) => ({ run: async () => db.prepare(sql).run(...values) }) }) } },
  };
}

test('study filtering retains only anonymous allowlisted settings and numeric print information', () => {
  const raw = valid();
  Object.assign(raw, { name: 'Person', ip: '192.0.2.1', userId: 'visitor', filename: 'private.svg', artwork: '<svg/>' });
  raw.dimensions.title = 'private design';
  raw.properties.settings = { pattern: 'waves', spacing: 3, backing: true, name: 'Person', shape: 'private artwork', seed: Infinity, depth: NaN, width: '60' };
  raw.properties.print = { layerHeight: 0.2, layers: 3, nozzleDiameter: -1, extrusionWidth: '0.4', profile: 'My printer' };
  raw.properties.metrics = { timeSec: 120, filamentMm: 15, moves: 35, title: 'private' };
  raw.properties.sources = { svg: true, image: 'yes', paths: 'M0,0 L1,1' };
  raw.properties.panel = { repeat: 25, backingSpacing: 4, svg: 'secret' };
  assert.deepEqual(sanitizeStudyRecord(raw), {
    schemaVersion: 1, noticeVersion: STUDY_NOTICE_VERSION, eventId: id, design: 'squiggle', exportType: 'gcode-swatch',
    dimensions: { width: 60, height: 40 },
    properties: { settings: { pattern: 'waves', spacing: 3, backing: true }, print: { layerHeight: 0.2, layers: 3 },
      metrics: { timeSec: 120, filamentMm: 15, moves: 35 }, sources: { svg: true, image: false }, panel: { repeat: 25, backingSpacing: 4 } },
  });
});

test('study rejects invalid records, coerced identifiers and out-of-range dimensions', () => {
  for (const patch of [
    { eventId: [id] }, { eventId: 'visitor' }, { noticeVersion: 'old' }, { design: 'unknown' },
    { exportType: 'artwork' }, { dimensions: null }, { dimensions: { width: 0, height: 1 } },
    { dimensions: { width: 1, height: 5001 } }, { dimensions: { width: '60', height: 40 } },
  ]) assert.equal(sanitizeStudyRecord({ ...valid(), ...patch }), null, JSON.stringify(patch));
  assert.equal(sanitizeStudyRecord(null), null);
});

test('study normalizes UUID casing so a retry cannot become another export', () => {
  assert.equal(sanitizeStudyRecord({ ...valid(), eventId: id.toUpperCase() }).eventId, id);
});

test('study records fixed hub choices without accepting free text', () => {
  for (const hubStyle of ['solid', 'open']) {
    const raw = valid();
    raw.properties.settings = { hub: 2, hubStyle };
    assert.deepEqual(sanitizeStudyRecord(raw).properties.settings, { hub: 2, hubStyle });
  }
  const raw = valid();
  raw.properties.settings = { hubStyle: 'private free text' };
  assert.deepEqual(sanitizeStudyRecord(raw).properties.settings, {});
});

test('study build failures keep fixed error codes and numeric limits but strip error messages and artwork', () => {
  for (const code of ['crossing-limit', 'move-limit', 'bed-fit', 'invalid-settings', 'empty-geometry', 'unknown-build-error']) {
    const raw = { ...valid(), exportType: 'build-error' };
    raw.properties.error = { code, limit: 120000, observed: 120001, message: 'private.svg failed', stack: 'private file', paths: ['M0,0 L1,1'] };
    const result = sanitizeStudyRecord(raw);
    assert.ok(result, code);
    assert.equal(result.exportType, 'build-error');
    assert.deepEqual(result.properties.error, { code, limit: 120000, observed: 120001 });
    assert.doesNotMatch(JSON.stringify(result), /private|M0,0/);
  }
});

test('study build failures require a known code and drop invalid numeric diagnostics', () => {
  for (const error of [undefined, null, {}, { code: 'private error text' }, { code: ['crossing-limit'] }]) {
    const raw = { ...valid(), exportType: 'build-error' };
    raw.properties.error = error;
    assert.equal(sanitizeStudyRecord(raw), null);
  }
  const raw = { ...valid(), exportType: 'build-error' };
  raw.properties.error = { code: 'crossing-limit', limit: '120000', observed: Infinity };
  assert.deepEqual(sanitizeStudyRecord(raw).properties.error, { code: 'crossing-limit' });
  raw.properties.error = { code: 'crossing-limit', limit: -1, observed: 1e10 };
  assert.deepEqual(sanitizeStudyRecord(raw).properties.error, { code: 'crossing-limit' });
});

test('study exports do not retain failure metadata supplied with an ordinary download', () => {
  const raw = valid();
  raw.properties.error = { code: 'crossing-limit', message: 'private detail' };
  assert.equal('error' in sanitizeStudyRecord(raw).properties, false);
});

test('study SVG complexity counts are anonymous numeric summaries only', () => {
  const raw = valid();
  raw.properties.sources = { svg: true, image: false, svgPaths: 3, svgPoints: 250, svgGuides: 2, filename: 'private.svg', svgContent: '<svg/>' };
  assert.deepEqual(sanitizeStudyRecord(raw).properties.sources, { svg: true, image: false, svgPaths: 3, svgPoints: 250, svgGuides: 2 });
  raw.properties.sources = { svgPaths: -1, svgPoints: '250', svgGuides: NaN };
  assert.deepEqual(sanitizeStudyRecord(raw).properties.sources, { svg: false, image: false });
});

test('study database and analysis queries separate build failures from downloads', async (t) => {
  const { db, env } = database(t);
  for (const [i, exportType] of ['gcode-swatch', 'gcode-panel', 'settings-json', 'build-error'].entries()) {
    const raw = { ...valid(), exportType, eventId: `abcde123-1234-4234-8234-123456789ab${i}` };
    if (exportType === 'build-error') {
      raw.properties.error = { code: 'crossing-limit', limit: 120000, observed: 120001, message: 'private detail' };
      raw.properties.sources = { svg: true, svgPaths: 4, svgPoints: 300, svgGuides: 2 };
    }
    assert.equal((await onRequest({ request: request(JSON.stringify(raw)), env })).status, 204);
  }
  const row = db.prepare("SELECT properties_json FROM export_events WHERE export_type = 'build-error'").get();
  assert.deepEqual(JSON.parse(row.properties_json).error, { code: 'crossing-limit', limit: 120000, observed: 120001 });
  assert.doesNotMatch(row.properties_json, /private/);
  const statements = readFileSync(new URL('../reference/study-statistics.sql', import.meta.url), 'utf8').split(';').filter((sql) => sql.trim());
  const results = statements.map((sql) => db.prepare(sql).all());
  assert.equal(results[0][0].exports, 2);
  assert.equal(results[1].reduce((sum, row) => sum + row.exports, 0), 3);
  assert.ok(results[1].every((row) => row.export_type !== 'build-error'));
  assert.equal(results[2][0].exports, 2);
  assert.equal(results[3][0].exports, 2);
  assert.equal(results[4][0].design, 'squiggle');
  assert.equal(results[4][0].error_code, 'crossing-limit');
  assert.equal(results[4][0].failures, 1);
});

test('study client gates anonymous build failures behind the same visible notice', async (t) => {
  const { db, env } = database(t);
  const notice = { hidden: true };
  const raw = { ...valid(), exportType: 'build-error' };
  raw.properties.error = { code: 'move-limit', limit: 300000, observed: 300001, message: 'private.svg' };
  const recorder = createStudyRecorder(notice, { uuid: () => id, fetcher: async (path, options) => path.endsWith('status') ? onRequestGet({ env }) : onRequest({ env, request: request(options.body) }) });
  assert.equal(await recorder.record(raw), false);
  await recorder.init();
  assert.equal(await recorder.record(raw), true);
  notice.hidden = true;
  assert.equal(await recorder.record(raw), false);
  const row = db.prepare('SELECT export_type, properties_json FROM export_events').get();
  assert.equal(row.export_type, 'build-error');
  assert.deepEqual(JSON.parse(row.properties_json).error, { code: 'move-limit', limit: 300000, observed: 300001 });
});

test('study status stays disabled without both an explicit enable flag and database', async () => {
  for (const env of [{}, { STUDY_ENABLED: 'true' }, { STUDY_DB: {} }, { STUDY_ENABLED: true, STUDY_DB: {} }, { STUDY_ENABLED: 'false', STUDY_DB: {} }]) {
    const response = onRequestGet({ env });
    assert.deepEqual(await response.json(), { enabled: false });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.deepEqual(await onRequestGet({ env: { STUDY_ENABLED: 'true', STUDY_DB: {} } }).json(), { enabled: true });
});

test('study endpoint stores only filtered fields, a UTC day and one row per UUID', async (t) => {
  const { db, env } = database(t);
  const payload = { ...valid(), userId: 'private', ip: '192.0.2.1' };
  payload.properties.settings.filename = 'private.svg';
  assert.equal((await onRequest({ request: request(JSON.stringify(payload)), env })).status, 204);
  assert.equal((await onRequest({ request: request(JSON.stringify({ ...payload, eventId: id.toUpperCase() })), env })).status, 204);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM export_events').get().n, 1);
  const row = db.prepare('SELECT * FROM export_events').get();
  assert.equal(row.event_id, id);
  assert.equal(row.design, 'squiggle');
  assert.equal(row.export_type, 'gcode-swatch');
  assert.equal(row.width_mm, 60);
  assert.equal(row.height_mm, 40);
  assert.match(row.created_day, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(row).sort(), ['created_day', 'design', 'event_id', 'export_type', 'height_mm', 'notice_version', 'properties_json', 'schema_version', 'width_mm']);
  assert.deepEqual(JSON.parse(row.properties_json).settings, { pattern: 'waves', spacing: 3, backing: true });
});

test('study endpoint gives separate export IDs separate rows', async (t) => {
  const { db, env } = database(t);
  const another = { ...valid(), eventId: 'abcde123-1234-4234-8234-123456789abd', exportType: 'settings-json' };
  await Promise.all([onRequest({ request: request(), env }), onRequest({ request: request(JSON.stringify(another)), env })]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM export_events').get().n, 2);
});

test('study endpoint rejects unsupported methods, disabled collection and cross-origin submissions before storage', async (t) => {
  const { db, env } = database(t);
  const method = await onRequest({ request: new Request(`${origin}/api/study/exports`), env });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('Allow'), 'POST');
  assert.equal((await onRequest({ request: request(), env: { ...env, STUDY_ENABLED: 'false' } })).status, 503);
  for (const value of ['https://other.example', 'null', '']) assert.equal((await onRequest({ request: request(undefined, { Origin: value }), env })).status, 403);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM export_events').get().n, 0);
});

test('study endpoint accepts JSON parameters but rejects lookalike media types', async (t) => {
  const { env } = database(t);
  for (const value of ['application/json; charset=utf-8', 'Application/JSON']) assert.equal((await onRequest({ request: request(undefined, { 'Content-Type': value }), env })).status, 204);
  for (const value of ['text/plain', 'application/jsonBAD', 'application/jsonp']) assert.equal((await onRequest({ request: request(undefined, { 'Content-Type': value }), env })).status, 415);
});

test('study endpoint rejects malformed JSON and invalid records without inserting', async (t) => {
  const { db, env } = database(t);
  for (const body of ['{', '', 'null', '[]', JSON.stringify({ ...valid(), dimensions: { width: -1, height: 2 } })]) {
    assert.equal((await onRequest({ request: request(body), env })).status, 400, body);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM export_events').get().n, 0);
});

test('study endpoint bounds actual streamed bytes even without a trustworthy Content-Length', async (t) => {
  const { db, env } = database(t);
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(4096).fill(32)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const streamed = { url: `${origin}/api/study/exports`, method: 'POST', headers: new Headers({ Origin: origin, 'Content-Type': 'application/json', 'Content-Length': '1' }), body };
  // A bounded implementation reads the body stream directly, never materializing the complete body.
  streamed.text = async () => { throw new Error('Unbounded body read'); };
  assert.equal((await onRequest({ request: streamed, env })).status, 413);
  assert.equal(cancelled, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM export_events').get().n, 0);
});

test('study endpoint applies the limit in UTF-8 bytes and permits an exactly 8 KiB record', async (t) => {
  const { env } = database(t);
  const base = JSON.stringify(valid());
  assert.equal((await onRequest({ request: request(base + ' '.repeat(8192 - Buffer.byteLength(base))), env })).status, 204);
  const unicode = JSON.stringify({ ...valid(), discarded: 'é'.repeat(4096) });
  assert.equal((await onRequest({ request: request(unicode), env })).status, 413);
  assert.equal((await onRequest({ request: request(base, { 'Content-Length': '8193' }), env })).status, 413);
});

test('study storage failures return an unavailable response without exposing database errors', async () => {
  const env = { STUDY_ENABLED: 'true', STUDY_DB: { prepare() { throw new Error('secret connection details'); } } };
  const response = await onRequest({ request: request(), env });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.doesNotMatch(await response.text(), /secret/);
});

test('study client sends nothing until enabled status and visible notice, then sends filtered anonymous exports', async (t) => {
  const { db, env } = database(t);
  const notice = { hidden: true };
  const sent = [];
  let sequence = 0;
  const recorder = createStudyRecorder(notice, { uuid: () => sequence++ ? 'abcde123-1234-4234-8234-123456789abd' : id, fetcher: async (path, options) => {
    sent.push({ path, options });
    if (path.endsWith('status')) return onRequestGet({ env });
    return onRequest({ env, request: request(options.body) });
  } });
  assert.equal(await recorder.record(valid()), false);
  assert.equal(sent.length, 0);
  await recorder.init();
  assert.equal(notice.hidden, false);
  assert.equal(sent[0].options.credentials, 'omit');
  assert.equal(sent[0].options.referrerPolicy, 'no-referrer');
  assert.equal(sent[0].options.cache, 'no-store');
  notice.hidden = true;
  assert.equal(await recorder.record(valid()), false);
  notice.hidden = false;
  const payload = { ...valid(), name: 'Person', filename: 'private.svg' };
  assert.equal(await recorder.record(payload), true);
  assert.equal(await recorder.record(payload), true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM export_events').get().n, 2);
  for (const call of sent.slice(1)) {
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.credentials, 'omit');
    assert.equal(call.options.referrerPolicy, 'no-referrer');
    assert.equal(call.options.keepalive, true);
    assert.doesNotMatch(call.options.body, /private|Person/);
  }
});

test('study client remains off for disabled, malformed, unsuccessful and failed status requests', async () => {
  for (const status of [() => Response.json({ enabled: false }), () => Response.json(null), () => Response.json({ enabled: true }, { status: 503 }), () => { throw new Error('offline'); }]) {
    const notice = { hidden: false };
    let calls = 0;
    const recorder = createStudyRecorder(notice, { fetcher: async () => { calls++; return status(); } });
    await recorder.init();
    assert.equal(notice.hidden, true);
    assert.equal(await recorder.record(valid()), false);
    assert.equal(calls, 1);
  }
});

test('study client converts collection failures to false without interrupting the caller', async () => {
  for (const fail of [() => { throw new Error('offline'); }, () => new Response(null, { status: 503 })]) {
    const notice = { hidden: true };
    const recorder = createStudyRecorder(notice, { uuid: () => id, fetcher: async (path) => path.endsWith('status') ? Response.json({ enabled: true }) : fail() });
    await recorder.init();
    assert.equal(await recorder.record(valid()), false);
    assert.equal(await recorder.record({ ...valid(), design: 'unknown' }), false);
  }
  const recorder = createStudyRecorder({ hidden: true }, { uuid: () => { throw new Error('crypto unavailable'); }, fetcher: async () => Response.json({ enabled: true }) });
  await recorder.init();
  assert.equal(await recorder.record(valid()), false);
});
