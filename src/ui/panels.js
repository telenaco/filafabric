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
    this.readout = el('button', { type: 'button', class: 'ctl-readout editable', id: `${this.inputId}-out`, title: 'Click to type a value', 'aria-label': `${def.label}: type an exact value` });
    this.readout.addEventListener('click', () => this.edit());
    return el('div', { class: 'ctl' },
      el('div', { class: 'ctl-top' }, el('label', { class: 'ctl-label', for: this.inputId, text: def.label }), this.readout),
      el('p', { class: 'ctl-help', id: `${this.inputId}-help`, text: def.help }),
      this.input,
      el('div', { class: 'ctl-ends', 'aria-hidden': 'true' }, el('span', { text: def.lo }), el('span', { text: def.hi })));
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
    if (document.activeElement !== this.input) this.input.value = String(binding.get(def.key));
    const text = binding.readout(def.key);
    this.input.setAttribute('aria-valuetext', text);
    this.readout.textContent = text;
    const r = binding.range(def.key);
    const manual = binding.get(def.key) < r.min || binding.get(def.key) > r.max;
    this.readout.classList.toggle('manual-value', manual);
    this.readout.title = manual ? 'Manual value outside the slider range. Click to edit.' : 'Click to type an exact value';
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
      const input = el('input', { id: `${designId}-${axis}`, type: 'number', inputmode: 'decimal', min: range.min, max: range.max, step: range.step });
      const field = el('label', { class: 'size-field', for: input.id }, el('span', { class: 'size-label', text: label }), input, el('span', { class: 'unit', 'aria-hidden': 'true', text: 'mm' }));
      return { field, input, range, label: label.toLowerCase() };
    };
    this.width = make('w', 'Width', b.ranges.w);
    this.height = make('h', 'Height', b.ranges.h);
    const onInput = () => {
      for (const f of [this.width, this.height]) f.input.removeAttribute('aria-invalid');
      const bad = [this.width, this.height].find((f) => {
        const n = Number(f.input.value);
        return !f.input.value.trim() || !Number.isFinite(n) || n < f.range.min || n > f.range.max;
      });
      if (bad) {
        bad.input.setAttribute('aria-invalid', 'true');
        this.error.textContent = `Enter a ${bad.label} from ${bad.range.min} to ${bad.range.max} mm.`;
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
    this.node = el('div', { class: 'size-control' }, this.inputs, this.note, this.error);
  }

  update() {
    const follow = this.host.vectorSize();
    this.inputs.hidden = !!follow;
    this.note.hidden = !follow;
    if (follow) {
      this.note.textContent = `The size comes from the SVG: ${fmt(follow[0])} × ${fmt(follow[1])} mm. Remove the SVG to set it by hand.`;
      this.error.hidden = true;
      return;
    }
    const [w, h] = this.host.binding(this.designId).size.get();
    for (const [f, v] of [[this.width, w], [this.height, h]]) {
      if (document.activeElement !== f.input && f.input.getAttribute('aria-invalid') !== 'true') f.input.value = String(v);
    }
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
  }

  update() {
    const s = this.host.settings(this.designId);
    for (const { btn, field } of this.buttons) btn.setAttribute('aria-pressed', String(String(s[this.key]) === field));
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
    this.node = el('section', { class: 'group', 'aria-labelledby': this.titleId },
      el('h2', { class: 'eyebrow', id: this.titleId, text: spec.title }));
    for (const part of [].concat(this.buildBody())) if (part) this.node.append(part);
  }

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
    this.buttons = this.options().map((opt) => {
      const btn = el('button', { type: 'button', class: 'pattern', 'aria-pressed': 'false', title: opt.hint, ...opt.attrs });
      if (opt.html !== undefined) btn.innerHTML = opt.html;
      else btn.append(el('span', { text: opt.text }));
      btn.addEventListener('click', () => { opt.apply(); this.host.change(); });
      this.grid.append(btn);
      return { btn, opt };
    });
    return [this.hint(), this.grid];
  }

  refresh() {
    for (const { btn, opt } of this.buttons) btn.setAttribute('aria-pressed', String(opt.pressed()));
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

/* ---------- the one place a drawing comes in ---------- */

/**
 * The SVG import. A drawing comes in once, here, and does three things everywhere in the studio: its lines print first,
 * the swatch takes its size, and (if you ask) the pattern is cut to its closed shapes. `host.svg()` describes the
 * situation: { vector, usesVector, idleNote, allowsOutline, hasShapes, outlineOn, window }, and the card calls
 * host.importSvg(file), host.removeSvg() and host.setShapeOutline(on).
 */
export class SvgImportCard extends Control {
  constructor(host) {
    super(host);
    this.input = el('input', { type: 'file', accept: '.svg,image/svg+xml', class: 'visually-hidden', id: 'svg-lines-input' });
    this.pick = el('label', { class: 'btn svg-import', for: 'svg-lines-input', text: 'Import SVG' }, this.input);
    this.remove = el('button', { type: 'button', id: 'svg-lines-remove', class: 'link small', text: 'Remove SVG', hidden: true });
    this.info = el('p', { id: 'svg-lines-info', class: 'small muted' });
    this.shapeSwitch = el('input', { type: 'checkbox', role: 'switch', id: 'svg-outline-switch' });
    this.shapeRow = el('label', { class: 'switch-row', hidden: true }, this.shapeSwitch,
      el('span', {}, el('strong', { text: 'Fill its shapes with this pattern' }), el('small', { text: 'The pattern is cut to the SVG\'s closed shapes, with the shapes drawn as lines round it.' })));
    this.note = el('p', { id: 'svg-preview-note', class: 'small muted', hidden: true });
    this.node = el('section', { class: 'svg-layer-control', 'aria-label': 'SVG import' },
      el('div', { class: 'svg-layer-actions' }, this.pick, this.remove), this.info, this.shapeRow, this.note);

    this.input.addEventListener('change', (e) => { if (e.target.files[0]) void host.importSvg(e.target.files[0]); e.target.value = ''; });
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
    this.info.textContent = v ? `${v.name} · ${fmt(v.width)} × ${fmt(v.height)} mm · ${v.paths.length} paths` : s.idleNote;
    this.remove.hidden = !v;
    this.pick.firstChild.textContent = v ? 'Replace SVG' : 'Import SVG';
    // a design that draws the SVG itself has its own say about shapes; the others can be cut to them
    this.shapeRow.hidden = !(v && s.allowsOutline && !s.usesVector);
    this.shapeRow.classList.toggle('disabled', !s.hasShapes);
    this.shapeSwitch.disabled = !s.hasShapes;
    this.shapeSwitch.checked = !!s.outlineOn;
    this.note.hidden = !s.window;
    if (s.window) this.note.textContent = `Preview sample: ${fmt(s.window[0])} × ${fmt(s.window[1])} mm. Full SVG: ${fmt(v.width)} × ${fmt(v.height)} mm.`;
  }
}

