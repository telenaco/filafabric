import test from 'node:test';
import assert from 'node:assert/strict';

// A minimal stand-in for the DOM: enough for el() and RegionControls.update().
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.dataset = {}; this.textContent = ''; this.className = ''; this.hidden = false; }
  setAttribute(k, v) { this.attrs[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  fire(type) { for (const fn of this.listeners[type] ?? []) fn({}); }
  contains() { return false; }
  querySelector() { return null; }
  walk(fn) { fn(this); for (const c of this.children) if (c instanceof Node) c.walk(fn); }
  text() { let t = this.textContent; for (const c of this.children) t += c instanceof Node ? c.text() : String(c); return t; }
}
globalThis.document = { createElement: (tag) => new Node(tag), activeElement: null };
const { RegionControls } = await import('../../site/src/ui/region-controls.js');

const region = (id, hex, role, enabled) => ({ id, hex, color: hex === '#000000' ? 'other' : 'red', role, enabled, card: 'zigzag', pathIndices: [0] });

function controls(regions, selection) {
  const calls = [];
  const bar = new Node('div'), header = new Node('div');
  const c = new RegionControls({ bar, header, cards: [{ id: 'zigzag', name: 'Zigzag', status: 'ready', shelf: 'Flat' }], change: (id, patch) => calls.push({ id, patch }), select() {}, close() {}, useCard() {} });
  c.update(regions, selection, { enabled: true, width: 0.76, align: 'centre' });
  return { calls, header };
}

const find = (root, test) => { let hit = null; root.walk((n) => { if (!hit && test(n)) hit = n; }); return hit; };

test('an unticked colour says it is not in the preview yet, with a button that includes it', () => {
  const { calls, header } = controls([region('r1', '#ff0000', 'pattern', true), region('r2', '#000000', 'line', false)], 'r2');
  const note = find(header, (n) => /region-excluded-note/.test(n.className));
  assert.ok(note, 'a note is shown');
  assert.match(note.text(), /not in the preview yet/);
  find(note, (n) => n.tag === 'button').fire('click');
  assert.deepEqual(calls, [{ id: 'r2', patch: { enabled: true } }]);
});

test('a ticked colour shows no such note', () => {
  const { header } = controls([region('r2', '#000000', 'line', true)], 'r2');
  assert.equal(find(header, (n) => /region-excluded-note/.test(n.className)), null);
});

test('choosing what an unticked colour prints as also includes it, so the change shows', () => {
  const { calls, header } = controls([region('r2', '#000000', 'line', false)], 'r2');
  const role = find(header, (n) => n.tag === 'select' && n.attrs.id === 'region-role');
  role.fire('change');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].patch.enabled, true);
  assert.ok('role' in calls[0].patch);
});

test('editing a ticked colour does not touch whether it is included', () => {
  const { calls, header } = controls([region('r2', '#000000', 'line', true)], 'r2');
  find(header, (n) => n.tag === 'select' && n.attrs.id === 'region-role').fire('change');
  assert.equal('enabled' in calls[0].patch, false);
});
