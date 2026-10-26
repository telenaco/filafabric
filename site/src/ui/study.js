import { sanitizeStudyRecord, STUDY_NOTICE_VERSION } from '../engine/study-record.js';

/**
 * Counts exports and build failures only while the server is configured, the visitor has not said no (allowed) and the
 * research notice is visible. Never blocks a download.
 */
export function createStudyRecorder(notice, { fetcher = fetch, uuid = () => crypto.randomUUID(), allowed = () => true } = {}) {
  let enabled = false;
  const show = () => { notice.hidden = !enabled || !allowed(); };
  return {
    async init() {
      try {
        const response = await fetcher('/api/study/status', { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: AbortSignal.timeout(3000) });
        enabled = response.ok && (await response.json()).enabled === true;
      } catch { enabled = false; }
      show();
    },
    /** The visitor changed their choice: the notice (and with it the counting) follows. */
    refresh: show,
    async record(input) {
      if (!enabled || !allowed() || notice.hidden) return false;
      try {
        const record = sanitizeStudyRecord({ ...input, noticeVersion: STUDY_NOTICE_VERSION, eventId: uuid() });
        if (!record) return false;
        const response = await fetcher('/api/study/exports', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
        return response.ok;
      } catch { return false; }
    },
  };
}
