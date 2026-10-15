import { sanitizeStudyRecord, STUDY_NOTICE_VERSION } from '../engine/study-record.js';

/** Counts exports and build failures only while the server is configured and the research notice is visible. Never blocks a download. */
export function createStudyRecorder(notice, { fetcher = fetch, uuid = () => crypto.randomUUID() } = {}) {
  let enabled = false;
  return {
    async init() {
      try {
        const response = await fetcher('/api/study/status', { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: AbortSignal.timeout(3000) });
        enabled = response.ok && (await response.json()).enabled === true;
      } catch { enabled = false; }
      notice.hidden = !enabled;
    },
    async record(input) {
      if (!enabled || notice.hidden) return false;
      try {
        const record = sanitizeStudyRecord({ ...input, noticeVersion: STUDY_NOTICE_VERSION, eventId: uuid() });
        if (!record) return false;
        const response = await fetcher('/api/study/exports', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
        return response.ok;
      } catch { return false; }
    },
  };
}
