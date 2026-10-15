import { sanitizeStudyRecord, studyEnabled } from '../../../src/engine/study-record.js';

const reply = (status, message) => Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
const MAX_RECORD_BYTES = 8192;
class RecordTooLarge extends Error {}

async function readRecordBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  // Bound retained bytes before decoding or parsing, including chunked requests and false length headers.
  const bytes = new Uint8Array(MAX_RECORD_BYTES);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.byteLength > MAX_RECORD_BYTES - length) {
        await reader.cancel().catch(() => {});
        throw new RecordTooLarge();
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
  } finally { reader.releaseLock(); }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  if (!studyEnabled(env)) return reply(503, 'Study collection is not configured');
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply(403, 'Same-origin requests only');
  if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') return reply(415, 'JSON required');
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_RECORD_BYTES) return reply(413, 'Record too large');
  let record;
  try {
    record = sanitizeStudyRecord(JSON.parse(await readRecordBody(request)));
  } catch (error) { return error instanceof RecordTooLarge ? reply(413, 'Record too large') : reply(400, 'Invalid JSON'); }
  if (!record) return reply(400, 'Invalid export record');
  try {
    // Each UUID identifies one export, not a browser or participant. Retries do not count twice.
    await env.STUDY_DB.prepare('INSERT INTO export_events (event_id, schema_version, notice_version, design, export_type, width_mm, height_mm, properties_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_id) DO NOTHING')
      .bind(record.eventId, record.schemaVersion, record.noticeVersion, record.design, record.exportType, record.dimensions.width, record.dimensions.height, JSON.stringify(record.properties)).run();
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch { return reply(503, 'Study storage is unavailable'); }
}
