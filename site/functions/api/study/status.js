import { studyEnabled } from '../../../src/engine/study-record.js';

export function onRequestGet({ env }) {
  return Response.json({ enabled: studyEnabled(env) }, { headers: { 'Cache-Control': 'no-store' } });
}
