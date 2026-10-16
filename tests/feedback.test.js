import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FEEDBACK_ENDPOINT, FEEDBACK_EMAIL, FEEDBACK_KINDS, feedbackFields, pictureMailto, problemReport, sendFeedback } from '../src/ui/feedback.js';
import { projectRoot } from './helpers.js';

test('feedback goes to the owner\'s Formspree form, and pictures to the owner\'s email', () => {
  assert.equal(FEEDBACK_ENDPOINT, 'https://formspree.io/f/xeaevvbn');
  assert.equal(FEEDBACK_EMAIL, 'bubakidesign@gmail.com');
});

test('a message is sent with a subject saying what it is about and which design, and an optional reply address', () => {
  const { fields } = feedbackFields('pattern', { message: '  A honeycomb with bigger cells  ', email: 'maker@example.com', designName: 'Bubbles', release: 'r1' });
  assert.equal(fields._subject, 'Filafabric pattern request: Bubbles');
  assert.equal(fields.kind, FEEDBACK_KINDS.pattern.label);
  assert.equal(fields.message, 'A honeycomb with bigger cells');
  assert.equal(fields.email, 'maker@example.com');
  assert.equal(fields.release, 'r1');
  assert.equal('report' in fields, false, 'only a problem report carries the error details');

  const anonymous = feedbackFields('opinion', { message: 'Works well' }).fields;
  assert.equal('email' in anonymous, false, 'no email field when none was given');
  assert.equal(feedbackFields('nonsense', { message: 'x' }).fields._subject, 'Filafabric feedback', 'an unknown kind counts as general feedback');
});

test('an empty message or a mistyped email is caught before sending', () => {
  assert.match(feedbackFields('opinion', { message: '   ' }).error, /few words/);
  assert.match(feedbackFields('opinion', { message: 'hi', email: 'not-an-email' }).error, /email address/);
  // a problem report with its details attached can go without a description
  const { fields } = feedbackFields('problem', { message: '', report: '{"error":"x"}' });
  assert.equal(fields.report, '{"error":"x"}');
  assert.match(fields.message, /no description/);
  // the details only travel with a problem report
  assert.equal('report' in feedbackFields('opinion', { message: 'hi', report: 'x' }).fields, false);
});

test('the problem report keeps settings and errors but never the drawing, and stays bounded', () => {
  const recent = Array.from({ length: 12 }, (_, i) => ({
    at: `2026-10-16T10:0${i % 10}:00Z`, design: 'bubbles',
    error: { code: 'crossing-limit', message: `too many crossings ${i}`, stack: 'Error\n    at build'.padEnd(9000, '.') },
    settings: { spacing: 4 }, dimensions: { width: 100, height: 100 },
  }));
  const text = problemReport({
    release: 'r1', design: 'bubbles', size: { width: 100, height: 100 },
    settings: { spacing: 4, pattern: 'grid', vector: { paths: [[1, 2]] }, outline: [[0, 0]], svgText: '<svg><path d="M0 0"/></svg>' },
    print: { brim: 2 }, drawing: { svgPaths: 3, svgPoints: 120 }, error: 'Can\'t build', recent,
  });
  const report = JSON.parse(text);
  assert.equal(report.settings.spacing, 4);
  assert.equal(report.settings.pattern, 'grid');
  for (const key of ['vector', 'outline', 'svgText']) assert.equal(key in report.settings, false, `${key} is drawing data`);
  assert.equal(text.includes('<svg'), false);
  assert.deepEqual(report.drawing, { svgPaths: 3, svgPoints: 120 });
  assert.equal(report.recentErrors.length, 5, 'the latest five errors');
  assert.equal(report.recentErrors.at(-1).message, 'too many crossings 11');
  assert.ok(text.length <= 20000);
});

test('the picture link opens an email to the owner with the description filled in', () => {
  const url = pictureMailto('Wavy lines & loops?', 'Coil');
  assert.ok(url.startsWith('mailto:bubakidesign@gmail.com?subject='));
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  assert.equal(params.get('subject'), 'Filafabric pattern request (seen in Coil)');
  assert.match(params.get('body'), /^Wavy lines & loops\?/);
  assert.match(params.get('body'), /Attach your picture/);
  assert.ok(pictureMailto('x'.repeat(5000)).length < 5000, 'a long description is shortened to fit an email link');
});

test('sending posts JSON to Formspree and reports success, a refusal or no connection without throwing', async () => {
  const calls = [];
  const ok = await sendFeedback({ message: 'hi' }, { fetcher: async (url, init) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 200 }); } });
  assert.deepEqual(ok, { ok: true });
  assert.equal(calls[0].url, FEEDBACK_ENDPOINT);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Accept, 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { message: 'hi' });

  const refused = await sendFeedback({}, { fetcher: async () => new Response(JSON.stringify({ errors: [{ message: 'email should be an email' }] }), { status: 422 }) });
  assert.deepEqual(refused, { ok: false, message: 'email should be an email' });
  const plain = await sendFeedback({}, { fetcher: async () => new Response('busy', { status: 503 }) });
  assert.match(plain.message, /503/);
  const offline = await sendFeedback({}, { fetcher: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(offline.ok, false);
  assert.match(offline.message, /no connection/);
});

test('the page has the feedback button and its form, with every field the form script looks for', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  for (const id of ['btn-feedback', 'feedback-dialog', 'feedback-form', 'feedback-message', 'feedback-prompt', 'feedback-email', 'feedback-picture', 'feedback-mailto', 'feedback-report-box', 'feedback-include', 'feedback-report', 'feedback-status', 'feedback-send', 'feedback-cancel']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  for (const kind of Object.keys(FEEDBACK_KINDS)) assert.ok(html.includes(`name="kind" value="${kind}"`), kind);
  assert.ok(html.includes('name="_gotcha"'), 'a hidden field that only bots fill in');
});
