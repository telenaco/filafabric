// The settings panel as classes.
//
// Every design's panel is assembled from the same few parts, so a change to one part (how a slider reads out, how the
// size is hidden when an SVG is imported, what an option button looks like) is a change in one class and applies to
// every design.
//
//   Control               anything that draws itself and can refresh itself from the current settings
//     SliderControl       one labelled slider whose read-out can be typed over
//     SizeControl         the width and height fields (hidden while an SVG sets the size)
//     PatternPicker       a grid of pattern fields and the room for a pattern-size slider
//     Section             a titled group of a design's panel, shown only while its `when(settings)` holds
//       PresetsSection, SizeSection, ShapeSection, ChoiceSection, SwitchSection, SlidersSection, PatternSection
//     DesignPanel         one design's whole panel, built from the `controls` its registry entry describes
//     SvgImportCard       the single place a drawing comes in: its lines, and optionally its shape as the outline
//
// The panel does not know the studio. It is given a `host`, an object with these methods:
//   binding(id)          { get(key), set(key, value), range(key), readout(key), size: { ranges, get(), set(w, h, preset) } }
//   settings(id)         the design's settings object, which sections read and write
//   change()             a setting changed what the design is: refresh every control, regenerate, save
//   nudge()              a slider moved: refresh the read-outs and regenerate (the save happens on release)
//   sizeChanged()        the size was typed: refresh and regenerate
//   commit()             save the state to the undo history
//   toast(message)       say something briefly
//   vectorSize()         [w, h] of the imported SVG, or null when none is imported
//   svg()                what the import card shows, see SvgImportCard
import { el } from './dom.js';
import { validNumber } from './numeric.js';
import { FIELDS, createField } from '../engine/fields.js';
import { SHAPES } from '../engine/shapes.js';
import { shapeThumb } from './thumbs.js';

const fmt = (n) => String(Math.round(n * 10) / 10);

/** Base of everything in the panel: owns one DOM node, and refreshes it from the current settings. */
export class Control {
  constructor(host) {
    this.host = host;
    this.node = null;
  }

  /** Redraw from the current settings. The default does nothing. */
  update() {}

  /** Redraw what depends on the colour scheme (pictures drawn on a canvas). The default does nothing. */
  redraw() {}
}

/* ---------- single controls ---------- */

export class SliderControl extends Control {
  /** @param def { key, label, help, lo, hi, unit } as listed in a design's `sliders` group */
  constructor(host, designId, def) {
    super(host);
    this.designId = designId;
    this.def = def;
    this.inputId = `${designId}-${def.key}`;
    this.node = this.build();
  }

  get binding() {
    return this.host.binding(this.designId);
  }

  build() {
    const { def, binding } = this;
    const range = binding.range(def.key);
    this.input = el('input', { id: this.inputId, type: 'range', min: range.min, max: range.max, step: range.step, 'aria-describedby': `${this.inputId}-help` });
    this.input.value = String(binding.get(def.key));
    this.input.addEventListener('input', () => { binding.set(def.key, Number(this.input.value)); this.host.nudge(); });
    this.input.addEventListener('change', () => this.host.commit());
    this.warn = el('p', { class: 'ctl-warn small', hidden: true });
    this.readout = el('button', { type: 'button', class: 'ctl-readout editable', id: `${this.inputId}-out`, title: 'Click to type a value', 'aria-label': `${def.label}: type an exact value` });
    this.readout.addEventListener('click', () => this.edit());
    // the end labels say which way is which; the sentence of help is a tooltip on the label, and still read out
    return el('div', { class: 'ctl' },
      el('div', { class: 'ctl-top' }, el('label', { class: 'ctl-label', for: this.inputId, text: def.label, 'data-tip': def.help || false }), this.readout),
      el('p', { class: 'ctl-help visually-hidden', id: `${this.inputId}-help`, text: def.help }),
      this.input,
      el('div', { class: 'ctl-ends', 'aria-hidden': 'true' }, el('span', { text: def.lo }), el('span', { text: def.hi })),
      this.warn);
  }

  /** Swap the read-out for a number field so an exact value can be typed; Enter or leaving applies it, Escape cancels. */
  edit() {
    const { def, binding, readout } = this;
    const range = binding.range(def.key);
    const field = el('input', { type: 'number', class: 'ctl-edit', step: 'any', inputmode: 'decimal', 'aria-label': `${def.label}${def.unit ? ` in ${def.unit}` : ''}` });
    field.value = String(binding.get(def.key));
    let done = false;
    const finish = (apply) => {
      if (done) return;
      done = true;
      const raw = field.value.trim();
      const n = Number(raw);
      if (apply && raw !== '' && Number.isFinite(n)) {
        if (!validNumber(def.key, n, range)) {
          this.host.toast(`${def.label}: enter a valid ${range.min === 0 ? 'non-negative' : 'positive'} value.`);
          field.replaceWith(readout);
          readout.focus();
          return;
        }
        binding.set(def.key, n);
        this.host.nudge();
        this.host.commit();
      }
      field.replaceWith(readout);
      this.update();
      readout.focus();
    };
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    field.addEventListener('blur', () => finish(true));
    readout.replaceWith(field);
    field.focus();
    field.select();
  }

  update() {
    const { def, binding } = this;
    const available = binding.available?.(def.key) !== false;
    this.input.disabled = !available;
    this.readout.disabled = !available;
    if (document.activeElement !== this.input) this.input.value = String(binding.get(def.key));
    const text = binding.readout(def.key);
    this.input.setAttribute('aria-valuetext', text);
    this.readout.textContent = text;
    const r = binding.range(def.key);
    const manual = binding.get(def.key) < r.min || binding.get(def.key) > r.max;
    this.readout.classList.toggle('manual-value', manual);
    this.readout.title = manual ? 'Manual value outside the slider range. Click to edit.' : 'Click to type an exact value';
    // a typed value is used as typed; outside the range it only gets a warning
    this.warn.hidden = !manual;
    if (manual) this.warn.textContent = `${text} is outside the slider's usual range (${fmt(r.min)} to ${fmt(r.max)}). It is used as typed: lines may overlap or the print may not fit, so check the preview.`;
  }
}

/**
 * Width and height. While an SVG is imported the swatch is the SVG's own size, so the fields give way to a line
 * that says so: the same for every design, because every design builds its size from this class.
 */
export class SizeControl extends Control {
  constructor(host, designId) {
    super(host);
    this.designId = designId;
    const b = host.binding(designId).size;
    this.error = el('p', { class: 'field-error', id: `${designId}-size-error`, hidden: true });
    const make = (axis, label, range) => {
      const input = el('input', { id: `${designId}-${axis}`, type: 'number', inputmode: 'decimal', step: range.step });
      const field = el('label', { class: 'size-field', for: input.id }, el('span', { class: 'size-label', text: label }), input, el('span', { class: 'unit', 'aria-hidden': 'true', text: 'mm' }));
      return { field, input, range, label: label.toLowerCase() };
    };
    this.width = make('w', 'Width', b.ranges.w);
    this.height = make('h', 'Height', b.ranges.h);
    const onInput = () => {
      for (const f of [this.width, this.height]) f.input.removeAttribute('aria-invalid');
      const bad = [this.width, this.height].find((f) => {
        const n = Number(f.input.value);
        return !f.input.value.trim() || !Number.isFinite(n) || n <= 0;
      });
      if (bad) {
        bad.input.setAttribute('aria-invalid', 'true');
        this.error.textContent = `Enter a ${bad.label} greater than 0 mm.`;
        this.error.hidden = false;
        return;
      }
      this.error.hidden = true;
      b.set(Number(this.width.input.value), Number(this.height.input.value), null);
      this.host.sizeChanged();
    };
    for (const f of [this.width, this.height]) {
      f.input.addEventListener('input', onInput);
      f.input.addEventListener('change', () => this.host.commit());
    }
    this.inputs = el('div', { class: 'size-inputs' }, this.width.field, el('span', { class: 'times', 'aria-hidden': 'true', text: '×' }), this.height.field);
    this.note = el('p', { class: 'size-follows small muted', hidden: true });
    this.divider = el('div', { class: 'size-source-divider', text: 'or', 'aria-hidden': 'true' });
    this.svgSlot = el('div', { class: 'size-svg-slot' });
    this.brim = new SliderControl({ ...host, binding: () => host.binding('print') }, `${designId}-edge`, {
      key: 'brim', label: 'Brim', help: 'Side-by-side runs around the inside edge, printed first to hold the fabric ends. Adjacent runs overlap 20%. Two is the default; 0 turns it off. Type up to 50. These are lines, not vertical layers.',
      lo: 'Off', hi: 'Wide', unit: 'lines', edit: true,
    });
    this.brim.node.classList.add('brim-control');
    this.warn = el('p', { class: 'ctl-warn small', hidden: true });
    this.node = el('div', { class: 'size-control' }, this.inputs, this.divider, this.svgSlot, this.note, this.warn, this.error, this.brim.node);
  }

  update() {
    this.brim.update();
    const follow = this.host.vectorSize();
    this.inputs.hidden = !!follow;
    this.note.hidden = true;
    this.divider.hidden = !!follow;
    if (follow) {
      this.error.hidden = true;
      this.warn.hidden = true;
      return;
    }
    const [w, h] = this.host.binding(this.designId).size.get();
    for (const [f, v] of [[this.width, w], [this.height, h]]) {
      if (document.activeElement !== f.input && f.input.getAttribute('aria-invalid') !== 'true') f.input.value = String(v);
    }
    const outside = [[this.width, w], [this.height, h]].filter(([f, v]) => v < f.range.min || v > f.range.max);
    this.warn.hidden = outside.length === 0;
    if (outside.length) this.warn.textContent = `${outside.map(([f, v]) => `${f.label} ${fmt(v)} mm`).join(' and ')} is outside the usual ${outside[0][0].range.min} to ${outside[0][0].range.max} mm. It is used as typed; the preview shows a 100 mm window of it.`;
  }
}

/** A heat map of a pattern field in the accent colour: bright where the field is high. */
function drawFieldThumb(canvas, field) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const size = 48;
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, size, size);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#34469a';
  if (field === 'none') {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(10 + i * 14, 24, 5, 0, Math.PI * 2); ctx.stroke(); }
    return;
  }
  const sampler = createField(field);
  const cells = 24;
  ctx.fillStyle = accent;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      ctx.globalAlpha = 0.08 + 0.92 * sampler(((i + 0.5) / cells) * 100, ((cells - j - 0.5) / cells) * 100, 100, 100);
      ctx.fillRect(i * 2, j * 2, 2, 2);
    }
  }
}

/* ---------- a long list of options behind one line ---------- */

/** A list with more options than this sits behind one line that names the chosen option. */
export const FOLD_AFTER = 4;

const CHEVRON = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7l5 5 5-5"/></svg>';

/** The small pictures on section headers, so a closed panel can be read without reading its titles. */
const SECTION_ICONS = {
  presets: '<path d="M9 2.5l1.9 4 4.3.5-3.2 2.9.9 4.3L9 12l-3.9 2.2.9-4.3L2.8 7l4.3-.5z"/>',
  size: '<rect x="3" y="3" width="12" height="12" rx="2"/><path d="M7 3v2.5M11 3v2.5M3 7h2.5M3 11h2.5"/>',
  layers: '<path d="M9 3l6 3-6 3-6-3z"/><path d="M3 9.5l6 3 6-3M3 12.5l6 3 6-3"/>',
  sliders: '<path d="M3 5h7M13 5h2M3 13h2M8 13h7"/><circle cx="11.5" cy="5" r="1.6"/><circle cx="6.5" cy="13" r="1.6"/>',
  pattern: '<g fill="currentColor" stroke="none"><circle cx="4.5" cy="4.5" r="0.9"/><circle cx="9" cy="4.5" r="1.3"/><circle cx="13.5" cy="4.5" r="1.8"/><circle cx="4.5" cy="9" r="1.3"/><circle cx="9" cy="9" r="1.8"/><circle cx="13.5" cy="9" r="1.3"/><circle cx="4.5" cy="13.5" r="1.8"/><circle cx="9" cy="13.5" r="1.3"/><circle cx="13.5" cy="13.5" r="0.9"/></g>',
  shape: '<circle cx="6.5" cy="6.5" r="3.5"/><path d="M9.5 15.5l3-5.5 3 5.5z"/>',
  colour: '<path d="M9 2.5c3 3.6 4.5 6.2 4.5 8a4.5 4.5 0 01-9 0c0-1.8 1.5-4.4 4.5-8z"/>',
};

/** Which picture a section gets, from what kind of section it is or, for the hand-built panels, from its title. */
export function sectionIcon(title = '', kind = '') {
  const t = title.toLowerCase();
  if (kind === 'presets' || t.startsWith('start from')) return 'presets';
  if (kind === 'size' || t.includes('size')) return 'size';
  if (kind === 'pattern' || /pattern|grade|picture|turn with/.test(t)) return 'pattern';
  if (kind === 'sliders' || /look and feel|wave/.test(t)) return 'sliders';
  if (/layer|backing|structure/.test(t)) return 'layers';
  if (t.includes('colour')) return 'colour';
  return 'shape';
}

/** Whether a node inside a section's body would be on screen with the section open (nothing between is hidden). */
function shownIn(node, body) {
  for (let n = node; n && n !== body; n = n.parentElement) if (n.hidden) return false;
  return true;
}

/**
 * What a section is set to, read from its own controls in the order they appear: the size ("100 × 100 mm", or the
 * drawing's name and size while an SVG sets it), the chosen option of each group, each slider's read-out, and a switch
 * that is on. The line a closed section shows beside its title.
 */
export function summariseSection(body) {
  const parts = [];
  let switches = 0;
  for (const node of body.querySelectorAll('.size-inputs, button[aria-pressed="true"], .ctl-readout, input[role="switch"]')) {
    if (node.classList.contains('size-inputs')) {
      if (!node.hidden) {
        const [w, h] = [...node.querySelectorAll('input')].map((i) => i.value.trim());
        if (w && h) parts.push(`${w} × ${h} mm`);
      } else {
        const info = body.querySelector('#svg-lines-info');
        if (info && !info.hidden && info.textContent) parts.push(info.textContent);
      }
      continue;
    }
    if (!shownIn(node, body) || node.closest('.svg-layer-control')) continue;
    if (node.matches('input[role="switch"]')) {
      switches++;
      if (node.checked) parts.push(node.closest('label')?.querySelector('strong')?.textContent ?? 'On');
    } else if (node.matches('button[aria-pressed="true"]')) {
      const label = node.querySelector('.seg-main') ?? [...node.querySelectorAll(':scope > span')].filter((s) => !s.classList.contains('pattern-thumb')).at(-1);
      parts.push((label ?? node).textContent.trim());
    } else if (!node.closest('.ctl')?.querySelector('[aria-pressed="true"]')) {
      // a read-out that only repeats the option chosen beside it is left out
      parts.push(node.textContent.trim());
    }
  }
  const unique = [...new Set(parts.filter(Boolean))];
  if (!unique.length && switches) return 'Off';
  return unique.join(' · ');
}

/**
 * Collapse a whole section under a header that names it, shows a picture for it and, while it is closed, says what it is
 * set to. Every section starts closed, so a panel opens as a short list of what can be changed and what each is now.
 */
export class SectionFold extends Control {
  constructor(host, section, { id = 'section', open = false, icon = null } = {}) {
    super(host);
    this.node = section;
    const heading = section.querySelector('h2');
    const title = heading.textContent;
    this.body = el('div', { class: 'section-fold-body', id: `${id}-body`, hidden: !open });
    for (const child of [...section.childNodes]) if (child !== heading) this.body.append(child);
    this.button = el('button', { type: 'button', class: 'section-fold-toggle', 'aria-expanded': String(open), 'aria-controls': this.body.id });
    this.button.innerHTML = `<svg class="section-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SECTION_ICONS[icon ?? sectionIcon(title)]}</svg>`;
    this.summary = el('span', { class: 'section-fold-summary' });
    this.button.append(el('span', { class: 'section-fold-title', text: title }), this.summary);
    this.button.insertAdjacentHTML('beforeend', CHEVRON);
    heading.replaceChildren(this.button);
    section.classList.add('section-fold');
    section.append(this.body);
    this.button.addEventListener('click', () => {
      this.body.hidden = !this.body.hidden;
      this.button.setAttribute('aria-expanded', String(!this.body.hidden));
    });
    // the summary follows the controls however they change: a click, a typed size, or a redraw from elsewhere
    this.queued = false;
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => this.update()).observe(this.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden'] });
    }
    this.body.addEventListener('input', () => this.update());
    this.body.addEventListener('change', () => this.update());
    this.update();
  }

  /** Refresh the summary once the current round of changes is over, however many controls changed in it. */
  update() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      const text = summariseSection(this.body);
      if (this.summary.textContent !== text) this.summary.textContent = text;
    });
  }
}

/**
 * Folds a grid of option buttons (the chosen one has aria-pressed) behind a single line showing the chosen option's
 * picture and name. Choosing an option closes it again, so a long list never takes the panel's room.
 * The grid is moved into the fold, wherever it was.
 */
export class OptionFold extends Control {
  constructor(host, grid, { id = 'options', none = 'Custom' } = {}) {
    super(host);
    this.grid = grid;
    this.none = none;
    if (!grid.id) grid.id = `${id}-options`;
    this.picture = el('span', { class: 'fold-picture', 'aria-hidden': 'true' });
    this.name = el('span', { class: 'disc-title' });
    this.sub = el('span', { class: 'disc-sub' });
    this.button = el('button', { type: 'button', class: 'option-fold-button', 'aria-expanded': 'false', 'aria-controls': grid.id },
      this.picture, el('span', { class: 'disc-text' }, this.name, this.sub));
    this.button.insertAdjacentHTML('beforeend', CHEVRON);
    this.node = el('div', { class: 'option-fold' }, this.button);
    if (grid.parentNode) grid.parentNode.insertBefore(this.node, grid);
    this.node.append(grid);
    this.setOpen(false);
    this.button.addEventListener('click', () => this.setOpen(this.grid.hidden));
    grid.addEventListener('click', (e) => { if (e.target.closest('button')) this.setOpen(false); });
    this.update();
  }

  setOpen(open) {
    this.grid.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
  }

  update() {
    const buttons = [...this.grid.querySelectorAll('button')];
    const chosen = buttons.find((b) => b.getAttribute('aria-pressed') === 'true');
    const labels = chosen ? [...chosen.children].filter((c) => c.tagName === 'SPAN' && !c.classList.contains('pattern-thumb')) : [];
    this.name.textContent = chosen ? (labels.at(-1)?.textContent ?? chosen.textContent).trim() : this.none;
    this.sub.textContent = `${buttons.length} options`;
    this.button.title = chosen?.title ?? '';
    this.picture.replaceChildren();
    const pic = chosen?.querySelector('svg, canvas, .pattern-thumb');
    if (pic) {
      let copy;
      if (pic.tagName === 'CANVAS') {
        copy = el('canvas', { class: 'pattern-thumb', width: pic.width, height: pic.height });
        copy.getContext('2d').drawImage(pic, 0, 0);
      } else copy = pic.cloneNode(true);
      this.picture.append(copy);
    }
  }

  redraw() {
    this.update();
  }
}

/** The grid of pattern fields, and beside it the pattern-size slider (shown only while a pattern is chosen). */
export class PatternPicker extends Control {
  /** @param scale the slider description of the pattern size, or null */
  constructor(host, designId, key, patterns, titleId, { scale = null } = {}) {
    super(host);
    this.designId = designId;
    this.key = key;
    this.grid = el('div', { class: 'patterns', role: 'group', 'aria-labelledby': titleId });
    this.buttons = patterns.map((field) => {
      const canvas = el('canvas', { class: 'pattern-thumb', 'data-field': field, 'aria-hidden': 'true' });
      const btn = el('button', { type: 'button', class: 'pattern', 'data-choice': `${designId}:${key}:${field}`, 'aria-pressed': 'false', title: field === 'none' ? 'Every loop the same' : FIELDS[field].hint },
        canvas, el('span', { text: field === 'none' ? 'Plain' : FIELDS[field].label }));
      btn.addEventListener('click', () => { host.settings(designId)[key] = field; host.change(); });
      this.grid.append(btn);
      drawFieldThumb(canvas, field);
      return { btn, field };
    });
    this.scaleBox = el('div', { id: `${designId}-pattern-scale`, class: 'pattern-scale' });
    this.scale = scale ? new SliderControl(host, designId, scale) : null;
    if (this.scale) this.scaleBox.append(this.scale.node);
    this.node = el('div', { class: 'pattern-picker' }, this.grid, this.scaleBox);
  }

  redraw() {
    for (const { btn, field } of this.buttons) drawFieldThumb(btn.querySelector('canvas'), field);
    this.fold?.update();
  }

  update() {
    const s = this.host.settings(this.designId);
    for (const { btn, field } of this.buttons) btn.setAttribute('aria-pressed', String(String(s[this.key]) === field));
    this.fold?.update();
    this.scaleBox.hidden = !s.pattern || s.pattern === 'none';
    this.scale?.update();
  }
}

/* ---------- sections of a design's panel ---------- */

/** A titled group that shows only while its `when(settings)` is true (always, when it has none). */
export class Section extends Control {
  /** @param spec one entry of the design's `controls`; @param position { index, sliderGroup } */
  constructor(host, mod, spec, position) {
    super(host);
    this.mod = mod;
    this.spec = spec;
    this.position = position;
    this.titleId = `${mod.id}-group-${position.index}-title`;
    // a section without a title (a lone switch) is a row of its own: there is nothing to fold it under
    const titled = !!spec.title;
    this.node = el('section', { class: titled ? 'group' : 'group untitled', 'aria-labelledby': titled ? this.titleId : false },
      titled ? el('h2', { class: 'eyebrow', id: this.titleId, text: spec.title }) : null);
    for (const part of [].concat(this.buildBody())) if (part) this.node.append(part);
    this.fold = titled ? new SectionFold(host, this.node, { id: this.titleId, icon: sectionIcon(spec.title, spec.kind) }) : null;
    this.fold?.button.addEventListener('click', () => { if (!this.fold.body.hidden) this.opened(); });
  }

  /** The section was opened. The default does nothing. */
  opened() {}

  get settings() {
    return this.host.settings(this.mod.id);
  }

  get visible() {
    return typeof this.spec.when === 'function' ? !!this.spec.when(this.settings) : true;
  }

  /** The nodes under the title. */
  buildBody() {
    return [];
  }

  /** Refresh what is inside the group. */
  refresh() {}

  update() {
    this.node.hidden = !this.visible;
    if (!this.node.hidden) this.refresh();
    this.fold?.update();
  }

  hint() {
    return this.spec.hint ? el('p', { class: 'group-hint', text: this.spec.hint }) : null;
  }
}

/** A grid of option buttons, one of which is pressed. Subclasses say what the options are. */
class OptionSection extends Section {
  /** @returns [{ attrs, html?, text?, hint, pressed(), apply() }] */
  options() {
    return [];
  }

  gridAttrs() {
    return {};
  }

  buildBody() {
    this.grid = el('div', { class: 'patterns', role: 'group', 'aria-labelledby': this.titleId, ...this.gridAttrs() });
    this.pictures = [];
    this.buttons = this.options().map((opt) => {
      const btn = el('button', { type: 'button', class: 'pattern', 'aria-pressed': 'false', title: opt.hint, ...opt.attrs });
      if (opt.html !== undefined) btn.innerHTML = opt.html;
      else btn.append(el('span', { text: opt.text }));
      // a picture drawn from the design itself waits until the section is first opened
      if (opt.picture) {
        const slot = el('span', { class: 'option-picture', 'aria-hidden': 'true' });
        btn.prepend(slot);
        this.pictures.push({ slot, draw: opt.picture });
      }
      btn.addEventListener('click', () => { opt.apply(); this.host.change(); });
      this.grid.append(btn);
      return { btn, opt };
    });
    return [this.hint(), this.grid];
  }

  refresh() {
    for (const { btn, opt } of this.buttons) btn.setAttribute('aria-pressed', String(opt.pressed()));
  }

  /** Draws the waiting pictures one at a time, so the section opens at once and fills in. */
  opened() {
    const queue = this.pictures.splice(0);
    const step = () => {
      const job = queue.shift();
      if (!job) return;
      job.slot.innerHTML = job.draw();
      if (!job.slot.innerHTML) job.slot.hidden = true;
      setTimeout(step, 0);
    };
    if (queue.length) setTimeout(step, 0);
  }
}

/** "Start from": recipes that change several settings at once. */
export class PresetsSection extends OptionSection {
  gridAttrs() {
    return { id: `${this.mod.id}-presets` };
  }

  options() {
    return this.mod.presets.map((p) => ({
      attrs: { 'data-preset': p.id },
      text: p.name,
      hint: p.blurb,
      picture: this.mod.presetPicture ? () => this.mod.presetPicture(p) : this.host.presetPicture ? () => this.host.presetPicture(this.mod, p) : null,
      pressed: () => (this.mod.presetMatch ? this.mod.presetMatch(this.settings) : null) === p.id,
      apply: () => Object.assign(this.settings, p.patch),
    }));
  }
}

/** One of the strand shapes of the shape library. */
export class ShapeSection extends OptionSection {
  options() {
    const { key } = this.spec;
    return this.mod.shapes.map((shape) => ({
      attrs: { 'data-choice': `${this.mod.id}:${key}:${shape}` },
      html: `${shapeThumb(shape)}<span>${SHAPES[shape].label}</span>`,
      hint: SHAPES[shape].hint,
      pressed: () => String(this.settings[key]) === shape,
      apply: () => { this.settings[key] = shape; },
    }));
  }
}

/** One value out of a short list. An option may carry a `patch`: the sizes and angles that suit it. */
export class ChoiceSection extends OptionSection {
  options() {
    const { key } = this.spec;
    return this.spec.options.map((opt) => ({
      attrs: { 'data-choice': `${this.mod.id}:${key}:${opt.id}` },
      html: `${opt.thumb ?? ''}<span>${opt.label}</span>`,
      hint: opt.hint,
      picture: opt.thumb ? null : opt.picture ?? null,
      pressed: () => String(this.settings[key]) === opt.id,
      apply: () => { Object.assign(this.settings, opt.patch ?? {}); this.settings[key] = opt.id; },
    }));
  }
}

/** An on/off switch with its explanation beside it. */
export class SwitchSection extends Section {
  buildBody() {
    const { key, label, help } = this.spec;
    this.input = el('input', { type: 'checkbox', role: 'switch', 'data-switch': `${this.mod.id}:${key}` });
    this.input.addEventListener('change', () => { this.settings[key] = this.input.checked; this.host.change(); });
    return el('label', { class: 'switch-row' }, this.input, el('span', {}, el('strong', { text: label }), el('small', { text: help })));
  }

  refresh() {
    this.input.checked = !!this.settings[this.spec.key];
  }
}

/** The size of the swatch, with its error line. */
export class SizeSection extends Section {
  buildBody() {
    this.size = new SizeControl(this.host, this.mod.id);
    return el('div', { id: `${this.mod.id}-size` }, this.size.node);
  }

  refresh() {
    this.size.update();
  }
}

/** A group of sliders. */
export class SlidersSection extends Section {
  buildBody() {
    const suffix = this.position.sliderGroup ? `-${this.position.sliderGroup}` : '';
    this.sliders = this.spec.items.map((def) => new SliderControl(this.host, this.mod.id, def));
    return el('div', { id: `${this.mod.id}-sliders${suffix}`, class: 'controls' }, ...this.sliders.map((s) => s.node));
  }

  refresh() {
    for (const s of this.sliders) s.update();
  }
}

/** A grid of pattern fields (the brightness map a design reads) and its size slider. */
export class PatternSection extends Section {
  buildBody() {
    this.picker = new PatternPicker(this.host, this.mod.id, this.spec.key, this.mod.patterns, this.titleId, { scale: this.spec.scale ?? null });
    return [this.hint(), this.picker.node];
  }

  refresh() {
    this.picker.update();
  }

  redraw() {
    this.picker.redraw();
  }
}

/** What a section is called in a design's `controls` list, and the class that draws it. */
export const SECTION_TYPES = {
  presets: PresetsSection,
  size: SizeSection,
  shape: ShapeSection,
  choice: ChoiceSection,
  switch: SwitchSection,
  sliders: SlidersSection,
  pattern: PatternSection,
};

/** One design's whole panel: its name, then its sections in the order its registry entry lists them. */
export class DesignPanel extends Control {
  constructor(host, mod) {
    super(host);
    this.mod = mod;
    this.node = el('div', { id: `panel-${mod.id}`, class: 'panel', hidden: true },
      el('header', { class: 'panel-head' }, el('h1', { class: 'title', text: mod.name })));
    this.sections = [];
    let sliderGroup = 0;
    mod.controls.forEach((spec, index) => {
      const Type = SECTION_TYPES[spec.kind];
      if (!Type) throw new Error(`${mod.id}: no section type for "${spec.kind}"`);
      const section = new Type(host, mod, spec, { index, sliderGroup: spec.kind === 'sliders' ? sliderGroup++ : 0 });
      this.sections.push(section);
      this.node.append(section.node);
    });
  }

  update() {
    for (const section of this.sections) section.update();
  }

  redraw() {
    for (const section of this.sections) section.redraw();
  }
}

/**
 * The layer setup every design shares, kept in the printer setup: how thick each layer is (only the thicknesses the
 * nozzle can lay down are offered) and how many individual passes to add to the original design. One card for the whole
 * studio, so a change is made once. The host's 'print' binding gives { get, set, range, readout, options(), note() }.
 * @param defs { thickness: { label, help }, layers: a slider description }
 */
export class PrintSetupCard extends Control {
  constructor(host, { thickness, layers }) {
    super(host);
    this.layers = new SliderControl(host, 'print', layers);
    this.readout = el('span', { class: 'ctl-readout', id: 'layer-thickness-value' });
    this.note = el('p', { class: 'ctl-help', id: 'layer-thickness-note' });
    this.grid = el('div', { class: 'patterns layer-choices', id: 'layer-thickness-choices', role: 'group', 'aria-labelledby': 'layer-thickness-label' });
    this.built = '';
    this.fold = null;
    this.node = el('section', { class: 'print-setup', 'aria-labelledby': 'print-setup-title' },
      el('h3', { id: 'print-setup-title', text: 'Layers' }),
      el('div', { class: 'ctl' },
        el('div', { class: 'ctl-top' }, el('span', { class: 'ctl-label', id: 'layer-thickness-label', text: thickness.label }), this.readout),
        el('p', { class: 'ctl-help', text: thickness.help }),
        this.grid,
        this.note),
      this.layers.node);
  }

  get binding() {
    return this.host.binding('print');
  }

  build(options) {
    const { binding } = this;
    this.grid.replaceChildren(...options.map((v) => {
      const btn = el('button', { type: 'button', class: 'pattern', 'data-layer-height': String(v), 'aria-pressed': 'false', text: `${v} mm` });
      btn.addEventListener('click', () => { binding.set('layerHeight', v); this.host.nudge(); this.host.commit(); });
      return btn;
    }));
    this.built = options.join(',');
    if (!this.fold && options.length > FOLD_AFTER) this.fold = new OptionFold(this.host, this.grid, { id: 'layer-thickness' });
  }

  update() {
    const { binding } = this;
    const options = binding.options();
    if (options.join(',') !== this.built) this.build(options);
    for (const btn of this.grid.children) btn.setAttribute('aria-pressed', String(Number(btn.dataset.layerHeight) === binding.get('layerHeight')));
    this.readout.textContent = binding.readout('layerHeight');
    this.note.textContent = binding.note();
    this.fold?.update();
    this.layers.update();
  }

  redraw() {
    this.fold?.update();
  }
}

/* ---------- the one place a drawing comes in ---------- */

/** The sample drawing on the site (samples/), to try or to open and copy: red fills, a blue hole, green guides, lines. */
export const SAMPLE_SVG = 'samples/filafabric-sample.svg';

/**
 * The SVG import. A drawing comes in once, here, and does three things everywhere in the studio: its lines print first,
 * the swatch takes its size, and (if you ask) the pattern is cut to its closed shapes. `host.svg()` describes the
 * situation: { vector, summary, usesVector, idleNote, allowsOutline, hasShapes, outlineOn, window }, and the card calls
 * host.importSvg(file), host.removeSvg() and host.setShapeOutline(on).
 */
export class SvgImportCard extends Control {
  constructor(host) {
    super(host);
    this.input = el('input', { type: 'file', accept: '.svg,image/svg+xml', class: 'visually-hidden', id: 'svg-lines-input', tabindex: '-1' });
    this.pickText = el('span', { text: 'Import SVG' });
    this.pick = el('label', { class: 'btn svg-import', for: 'svg-lines-input', tabindex: '0', role: 'button' }, this.pickText, this.input);
    this.pick.insertAdjacentHTML('afterbegin', '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12.5V4M5.5 7.5L9 4l3.5 3.5M3 14.5h12"/></svg>');
    // the whole card takes a dropped file; this says so while no drawing is in
    this.dropHint = el('span', { class: 'small muted svg-drop-hint', text: 'or drop a file here', 'aria-hidden': 'true' });
    this.remove = el('button', { type: 'button', id: 'svg-lines-remove', class: 'link small', text: 'Remove SVG', hidden: true });
    this.info = el('p', { id: 'svg-lines-info', class: 'small muted' });
    this.shapeSwitch = el('input', { type: 'checkbox', role: 'switch', id: 'svg-outline-switch' });
    this.shapeRow = el('label', { class: 'switch-row', hidden: true, title: 'Cut this pattern to the red SVG shapes, leaving blue holes empty. Pattern ends meet the printed borders.' }, this.shapeSwitch,
      el('span', {}, el('strong', { text: 'Fill its shapes with this pattern' })));
    this.note = el('p', { id: 'svg-preview-note', class: 'small muted', hidden: true });
    // a drawing to try, for whoever has none: every colour the studio reads, in one file that can be opened to see how
    this.tryButton = el('button', { type: 'button', id: 'svg-sample-try', class: 'link small', text: 'use the sample drawing' });
    const download = el('a', { href: SAMPLE_SVG, download: 'filafabric-sample.svg', class: 'link small svg-sample-download', id: 'svg-sample-download',
      title: 'A 200 x 200 mm drawing with every colour: red shapes are filled, the blue star is a hole, green bends the pattern, and the lines print as paths. Open it in Inkscape or Illustrator to see how it is set up.' });
    download.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v7M5 7l3 3 3-3M3 12.5h10"/></svg>';
    download.append('Download the SVG sample with colours');
    this.sample = el('div', { class: 'svg-sample small muted' },
      el('p', {}, 'or ', this.tryButton),
      el('p', {}, download));
    this.node = el('div', { class: 'svg-layer-control', 'aria-label': 'SVG import' },
      el('div', { class: 'svg-layer-actions' }, this.pick, this.dropHint, this.remove), this.sample, this.info, this.shapeRow, this.note);
    this.tryButton.addEventListener('click', async () => {
      try {
        const res = await fetch(SAMPLE_SVG);
        if (!res.ok) throw new Error(`${res.status}`);
        await host.importSvg(new File([await res.text()], 'filafabric-sample.svg', { type: 'image/svg+xml' }));
      } catch {
        host.toast('The sample drawing could not be loaded. Download it and import it instead.');
      }
    });

    this.input.addEventListener('change', (e) => { if (e.target.files[0]) void host.importSvg(e.target.files[0]); e.target.value = ''; });
    this.pick.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.input.click(); } });
    this.remove.addEventListener('click', () => host.removeSvg());
    this.shapeSwitch.addEventListener('change', () => host.setShapeOutline(this.shapeSwitch.checked));
    const node = this.node;
    node.addEventListener('dragover', (e) => { e.preventDefault(); node.classList.add('dragover'); });
    node.addEventListener('dragleave', () => node.classList.remove('dragover'));
    node.addEventListener('drop', (e) => { e.preventDefault(); node.classList.remove('dragover'); if (e.dataTransfer.files[0]) void host.importSvg(e.dataTransfer.files[0]); });
  }

  update() {
    const s = this.host.svg();
    const v = s.vector;
    this.info.textContent = v ? `${v.name} · ${fmt(v.width)} × ${fmt(v.height)} mm` : '';
    this.info.hidden = !v;
    this.pick.dataset.tip = `${v ? `Replace this drawing. Prints: ${s.summary}.` : 'Use the SVG document’s size and print its vector lines first.'} With a standard 0.4 mm nozzle, stroke widths of 0.4 mm print one pass, 0.8 mm two, 1.2 mm three, and so on. Adjacent passes overlap by at least 20%. Black lines print as paths; red contains the pattern; blue blocks it; green bends the pattern around its contour. Lines that meet are printed in as few strokes as they allow.`;
    this.pick.setAttribute('aria-description', this.pick.dataset.tip);
    this.remove.hidden = !v;
    this.dropHint.hidden = !!v;
    this.sample.hidden = !!v;
    this.pickText.textContent = v ? 'Replace SVG' : 'Import SVG';
    // a design that draws the SVG itself has its own say about shapes; the others can be cut to them
    this.shapeRow.hidden = !(v && s.allowsOutline && !s.usesVector);
    this.shapeRow.classList.toggle('disabled', !s.hasShapes);
    this.shapeSwitch.disabled = !s.hasShapes;
    this.shapeSwitch.checked = !!s.outlineOn;
    this.note.hidden = !s.window;
    if (s.window) this.note.textContent = `Preview sample: ${fmt(s.window[0])} × ${fmt(s.window[1])} mm. Full SVG: ${fmt(v.width)} × ${fmt(v.height)} mm.`;
  }
}
