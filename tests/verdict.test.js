import test from 'node:test';
import assert from 'node:assert/strict';
import { proportionPhrase, buildVerdict, buildSquiggleVerdict, formatMinutes, shareLabel } from '../src/ui/verdict.js';

const stats = (over) => ({ loops: 567, violations: 19206, extrudingMoves: 47800, ...over });

test('proportion phrases are plain and rounded', () => {
  assert.equal(proportionPhrase(0.402), '4 in 10');
  assert.equal(proportionPhrase(0.328), '3 in 10');
  assert.equal(proportionPhrase(0.065), '1 in 15');
  assert.equal(proportionPhrase(0.054), '1 in 19');
  assert.equal(proportionPhrase(0.004), 'very few');
  assert.equal(proportionPhrase(0), 'very few');
});

test('tight layout gives a heads-up with the roomy action', () => {
  const v = buildVerdict(stats(), { roomy: false });
  assert.equal(v.level, 'heads-up');
  assert.match(v.title, /tight/i);
  assert.match(v.body, /4 in 10/);
  assert.equal(v.action, 'roomy-on');
  assert.match(v.actionLabel, /more room/i);
});

test('after making room the verdict is workable and offers undo', () => {
  // measured: 3,060 flagged of about 47,100 extruding moves on the full swatch with extra room
  const v = buildVerdict(stats({ violations: 3060, extrudingMoves: 47100 }), { roomy: true });
  assert.equal(v.level, 'ok');
  assert.match(v.title, /workable/i);
  assert.match(v.body, /1 in 15/);
  assert.equal(v.action, 'roomy-off');
});

test('extra room that still leaves many flags says so instead of reassuring', () => {
  const v = buildVerdict(stats({ violations: 12000, extrudingMoves: 40000 }), { roomy: true });
  assert.equal(v.level, 'heads-up');
  assert.match(v.title, /still tight/i);
  assert.match(v.body, /3 in 10/);
});

test('almost no flags reads as good in either mode', () => {
  const v = buildVerdict(stats({ violations: 40 }), { roomy: false });
  assert.equal(v.level, 'ok');
  assert.match(v.title, /good/i);
  assert.equal(v.action, null);
});

test('no loops explains why only the base will print', () => {
  const v = buildVerdict(stats({ loops: 0, violations: 0 }), { roomy: false });
  assert.equal(v.level, 'info');
  assert.match(v.body, /base/i);
});

test('minutes and share labels read well', () => {
  assert.equal(formatMinutes(3.2), '3.2');
  assert.equal(formatMinutes(50.6), '51');
  assert.equal(formatMinutes(0), '0.0');
  assert.equal(shareLabel(0.402), 'about 4 in 10');
});

test('the squiggle verdict says what will happen, with or without a colour change', () => {
  const plain = buildSquiggleVerdict({ hops: 1 }, { colorChange: false });
  assert.equal(plain.level, 'ok');
  assert.equal(plain.action, null);
  assert.match(plain.body, /one lift/);
  assert.match(buildSquiggleVerdict({ hops: 2 }, { colorChange: true }).body, /2 lifts.*second colour/);
});
