// Feedback from the people using the studio: what works and what doesn't, a pattern they would like, or a problem.
// Messages go to the owner's Formspree form, which forwards them by email. A picture goes by the person's own email
// app instead (a mailto with the description filled in), so nothing here uploads files. A problem report carries the
// recent error history and the current settings, shown in full before it is sent; never the drawing itself.
import { safeMetadata } from './diagnostics.js';

export const FEEDBACK_ENDPOINT = 'https://formspree.io/f/xeaevvbn';
export const FEEDBACK_EMAIL = 'bubakidesign@gmail.com';

export const FEEDBACK_KINDS = {
  opinion: {
    label: 'What works, what doesn\'t',
    subject: 'Filafabric feedback',
    prompt: 'What works well, and what doesn\'t?',
    placeholder: 'For example: the bubbles printed well on my A1 mini, but the brim was hard to peel off.',
  },
  pattern: {
    label: 'Request a pattern',
    subject: 'Filafabric pattern request',
    prompt: 'Describe the pattern you would like',
    placeholder: 'What it looks like, what it is for, how open, dense or stretchy it should be.',
  },
  problem: {
    label: 'Report a problem',
    subject: 'Filafabric problem report',
    prompt: 'What were you doing when it went wrong?',
    placeholder: 'For example: I imported an SVG, picked Bubbles, and the preview never finished.',
  },
};

const MAX_MESSAGE = 5000;
const MAX_REPORT = 20000;
const RECENT_ERRORS = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const kindOf = (kind) => (Object.hasOwn(FEEDBACK_KINDS, kind) ? kind : 'opinion');

/** The text sent with a problem report: readable JSON, bounded, with no drawing geometry and no file names. */
export function problemReport({ release, browser, screen, design, size, settings, print, machine, material, drawing, error, recent = [] } = {}) {
  const errors = recent.slice(-RECENT_ERRORS).map((entry) => ({
    at: entry.at,
    design: entry.design,
    code: entry.error?.code,
    message: String(entry.error?.message ?? '').slice(0, 600),
    stack: typeof entry.error?.stack === 'string' ? entry.error.stack.slice(0, 1500) : undefined,
    settings: entry.settings,
    dimensions: entry.dimensions,
    sourceComplexity: entry.sourceComplexity,
  }));
  const report = {
    release, browser, screen, design, size,
    settings: safeMetadata(settings) ?? {},
    print: safeMetadata(print) ?? {},
    machine, material,
    drawing: drawing ? safeMetadata(drawing) : null,
    error: error ? String(error).slice(0, 1000) : null,
    recentErrors: errors,
  };
  let text = JSON.stringify(report, null, 2);
  // too long for one message: keep the latest errors and their messages, and drop the stack traces first
  while (text.length > MAX_REPORT && report.recentErrors.some((e) => e.stack)) {
    report.recentErrors.find((e) => e.stack).stack = undefined;
    text = JSON.stringify(report, null, 2);
  }
  while (text.length > MAX_REPORT && report.recentErrors.length) {
    report.recentErrors.shift();
    text = JSON.stringify(report, null, 2);
  }
  return text.slice(0, MAX_REPORT);
}

/** What the form sends, or what to fix first: { fields } or { error }. */
export function feedbackFields(kind, { message = '', email = '', report = '', designName = '', release = '' } = {}) {
  const k = kindOf(kind);
  const text = String(message).trim().slice(0, MAX_MESSAGE);
  const hasReport = k === 'problem' && !!report;
  if (!text && !hasReport) return { error: 'Write a few words first.' };
  const from = String(email).trim();
  if (from && !EMAIL.test(from)) return { error: 'That email address does not look right. Leave it empty if you do not need a reply.' };
  const fields = {
    _subject: `${FEEDBACK_KINDS[k].subject}${designName ? `: ${designName}` : ''}`,
    kind: FEEDBACK_KINDS[k].label,
    message: text || '(no description: see the error details)',
    design: designName || undefined,
    release: release || undefined,
    email: from || undefined, // Formspree makes this the reply-to address
    report: hasReport ? String(report).slice(0, MAX_REPORT) : undefined,
  };
  return { fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) };
}

/** A mailto that opens the person's email app with the description filled in, ready for a picture to be attached. */
export function pictureMailto(message = '', designName = '') {
  const subject = `Filafabric pattern request${designName ? ` (seen in ${designName})` : ''}`;
  const description = String(message).trim().slice(0, 1500);
  const body = `${description || 'The pattern I would like:'}\n\n(Attach your picture to this email.)`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Posts to Formspree. Resolves to { ok: true } or { ok: false, message }, and never throws. */
export async function sendFeedback(fields, { fetcher = fetch, endpoint = FEEDBACK_ENDPOINT, timeout = 15000 } = {}) {
  let response;
  try {
    response = await fetcher(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    return { ok: false, message: 'There was no connection to the form service.' };
  }
  if (response.ok) return { ok: true };
  let detail = '';
  try {
    const data = await response.json();
    detail = (data?.errors ?? []).map((e) => e?.message).filter(Boolean).join(' ') || data?.error || '';
  } catch { /* not JSON: the status says enough */ }
  return { ok: false, message: detail ? String(detail) : `The form service answered with error ${response.status}.` };
}

/**
 * Wires the feedback dialog in index.html. context() describes the studio right now:
 * { designName, release, report() } where report() builds the problem report text.
 */
export function bindFeedback(dialog, { context, toast, send = sendFeedback }) {
  const form = dialog.querySelector('#feedback-form');
  const message = dialog.querySelector('#feedback-message');
  const prompt = dialog.querySelector('#feedback-prompt');
  const email = dialog.querySelector('#feedback-email');
  const picture = dialog.querySelector('#feedback-picture');
  const mailto = dialog.querySelector('#feedback-mailto');
  const reportBox = dialog.querySelector('#feedback-report-box');
  const include = dialog.querySelector('#feedback-include');
  const reportText = dialog.querySelector('#feedback-report');
  const status = dialog.querySelector('#feedback-status');
  const sendButton = dialog.querySelector('#feedback-send');
  const trap = dialog.querySelector('[name="_gotcha"]');
  let report = '';
  let session = 0;
  let pending = null;

  const kind = () => kindOf(form.querySelector('[name="kind"]:checked')?.value);
  const say = (text, error = false) => {
    status.replaceChildren(text);
    status.classList.toggle('error', error);
  };
  const refreshMailto = () => { mailto.href = pictureMailto(message.value, context().designName); };
  const sendStatus = () => {
    if (!pending) return '';
    return pending.session === session ? 'Sending…' : 'A previous message is still being sent…';
  };
  function draft() {
    const selected = kind();
    return {
      kind: selected,
      message: message.value,
      email: email.value,
      report: selected === 'problem' && include.checked ? report : '',
    };
  }

  function update() {
    const k = kind();
    prompt.textContent = FEEDBACK_KINDS[k].prompt;
    message.placeholder = FEEDBACK_KINDS[k].placeholder;
    picture.hidden = k !== 'pattern';
    reportBox.hidden = k !== 'problem';
    if (k === 'problem') {
      report = context().report();
      reportText.textContent = report;
    }
    refreshMailto();
    say(sendStatus());
  }

  function open(k = 'opinion') {
    session++;
    const radio = form.querySelector(`[name="kind"][value="${kindOf(k)}"]`);
    if (radio) radio.checked = true;
    update();
    sendButton.disabled = !!pending;
    if (!dialog.open) dialog.showModal();
    message.focus();
  }

  form.addEventListener('change', (e) => { if (e.target.name === 'kind') update(); });
  message.addEventListener('input', refreshMailto);
  dialog.querySelector('#feedback-cancel').addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!dialog.open || pending) return;
    if (trap?.value) { dialog.close(); return; } // a bot filled the hidden field: drop it quietly
    const { designName, release } = context();
    const submitted = draft();
    const { fields, error } = feedbackFields(submitted.kind, { ...submitted, designName, release });
    if (error) { say(error, true); message.focus(); return; }

    const submission = { session };
    pending = submission;
    sendButton.disabled = true;
    say(sendStatus());
    let result;
    try {
      result = await send(fields);
    } catch {
      result = { ok: false, message: 'There was no connection to the form service.' };
    }
    pending = null;
    sendButton.disabled = false;

    // Closing the dialog leaves the POST in flight. A reopened dialog owns its own draft.
    if (submission.session !== session) {
      if (dialog.open) say('');
      if (result.ok) toast('Your earlier feedback was sent.');
      return;
    }
    const current = draft();
    const unchanged = Object.keys(submitted).every((key) => submitted[key] === current[key]);
    if (result.ok) {
      if (unchanged) {
        message.value = '';
        say('');
        if (dialog.open) dialog.close();
      } else if (dialog.open) {
        say('Message sent. Your new draft is still here.');
      }
      toast('Thank you: your message was sent.');
      return;
    }
    if (!dialog.open) return;
    if (!unchanged) {
      say('The previous message could not be sent. Your current draft is still here.', true);
      return;
    }
    const fallback = dialog.ownerDocument.createElement('a');
    fallback.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(fields._subject)}&body=${encodeURIComponent(fields.message)}`;
    fallback.textContent = FEEDBACK_EMAIL;
    const why = /[.!?]$/.test(result.message) ? result.message : `${result.message}.`;
    status.replaceChildren(`It could not be sent: ${why} Try again, or email `, fallback, '.');
    status.classList.add('error');
  });

  return { open };
}
