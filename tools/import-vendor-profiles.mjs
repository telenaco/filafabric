// Builds the printer library (profiles/library/) from the slicers' own vendor profiles, so the printer setup can offer
// the printers people actually have without anyone exporting a file first:
//
//   - PrusaSlicer: the vendor bundles of github.com/prusa3d/PrusaSlicer-settings-prusa-fff (Prusa Research) and
//     PrusaSlicer-settings-non-prusa-fff (Creality, Anycubic, Elegoo, ...): one .ini per vendor, latest version.
//   - Bambu Studio: every Bambu Lab printer, from resources/profiles/BBL in github.com/bambulab/BambuStudio.
//
// A preset in either library inherits from others (`inherits = *common*; *0.4nozzle*` in an .ini, `"inherits"` in a
// .json): each is resolved here, later parents and then its own values winning, and turned into this tool's profile
// with the same importer a dropped-in file goes through (src/engine/profile-import.js). Only printers for filament
// (FFF) are kept, in the nozzle sizes listed in NOZZLES, one preset per model and nozzle.
//
// For now the library holds the most used Bambu Lab and Prusa printers (POPULAR); `--all` builds every vendor below
// and every model they list (about 500 printers).
//
//   node tools/import-vendor-profiles.mjs                 download the latest vendor files and rebuild the library
//   node tools/import-vendor-profiles.mjs --all           every vendor and model, not only the popular ones
//   node tools/import-vendor-profiles.mjs --cache=DIR     keep the downloads in DIR and reuse them on the next run
//
// The library is generated: run this again to update it, rather than editing its files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfigText, machineFromSettings } from '../src/engine/profile-import.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'profiles', 'library');
const RAW = 'https://raw.githubusercontent.com';
const cacheArg = process.argv.find((a) => a.startsWith('--cache='));
const CACHE = cacheArg ? path.resolve(cacheArg.slice(8)) : null;

/** The nozzle sizes offered: the usual one, and the larger ones that suit a thick, flexible strand. */
const NOZZLES = [0.4, 0.6, 0.8];

const ALL = process.argv.includes('--all');

/**
 * The printers built by default, by the model name the vendor gives them, in the order they are listed. The Prusa MK3S
 * is left out: the studio's own profiles/machines/prusa-mk3s.json, tuned on a real printer, is that one.
 */
const POPULAR = {
  bambu: ['Bambu Lab A1 mini', 'Bambu Lab A1', 'Bambu Lab P1S', 'Bambu Lab P1P', 'Bambu Lab P2S', 'Bambu Lab X1 Carbon', 'Bambu Lab X1E', 'Bambu Lab H2D'],
  prusa: ['Prusa CORE One & One+ & One+ (Gen 2)', 'Original Prusa MK4S', 'Original Prusa MK4 Input Shaper', 'Original Prusa MK3.9S', 'Original Prusa MK3.5 & MK3.5S', 'Original Prusa MINI & MINI+ Input Shaper', 'Original Prusa XL Input Shaper'],
};

/** PrusaSlicer vendor bundles: the vendors whose printers are most common, Prusa first. */
const PRUSA_VENDORS = [
  { id: 'prusa', name: 'Prusa Research', repo: 'PrusaSlicer-settings-prusa-fff', folder: 'PrusaResearch' },
  { id: 'creality', name: 'Creality', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Creality' },
  { id: 'anycubic', name: 'Anycubic', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Anycubic' },
  { id: 'elegoo', name: 'Elegoo', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Elegoo' },
  { id: 'artillery', name: 'Artillery', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Artillery' },
  { id: 'sovol', name: 'Sovol', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Sovol' },
  { id: 'anker', name: 'Anker', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Anker' },
  { id: 'qidi', name: 'QIDI Technology', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'QIDITechnology' },
  { id: 'voron', name: 'Voron', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Voron' },
  { id: 'ratrig', name: 'RatRig', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'RatRig' },
  { id: 'biqu', name: 'BIQU', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'BIQU' },
  { id: 'flsun', name: 'FLSun', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'FLSun' },
  { id: 'snapmaker', name: 'Snapmaker', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Snapmaker' },
  { id: 'geeetech', name: 'Geeetech', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Geeetech' },
  { id: 'ultimaker', name: 'Ultimaker', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'Ultimaker' },
  { id: 'lulzbot', name: 'LulzBot', repo: 'PrusaSlicer-settings-non-prusa-fff', folder: 'LulzBot' },
];

const BAMBU = { id: 'bambu', name: 'Bambu Lab', base: `${RAW}/bambulab/BambuStudio/master/resources/profiles` };

/** A note shown with every printer of a vendor in the printer setup. */
const VENDOR_NOTES = {
  bambu: 'Bambu Studio sends these printers .gcode.3mf files. Check that yours will print a plain .gcode file (from its card or a network tool) before relying on this export.',
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const num = (v) => {
  const n = Number(String(Array.isArray(v) ? v[0] : v ?? '').split(/[,;]/)[0]);
  return Number.isFinite(n) ? n : null;
};

/* ---------- downloading ---------- */

async function fetchText(url) {
  const file = CACHE ? path.join(CACHE, slug(url.replace(RAW, '')).slice(-150)) : null;
  if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const text = await res.text();
  if (file) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, text); }
  return text;
}

/** The newest bundle of a PrusaSlicer vendor: index.idx lists its versions, newest first. */
async function latestBundle(vendor) {
  const base = `${RAW}/prusa3d/${vendor.repo}/main/${vendor.folder}`;
  const versions = (await fetchText(`${base}/index.idx`)).split(/\r?\n/).map((l) => /^(\d+\.\d+\.\d+(?:-[\w.]+)?)\b/.exec(l.trim())?.[1]).filter(Boolean);
  for (const version of versions) {
    try { return { version, text: await fetchText(`${base}/${version}.ini`), url: `https://github.com/prusa3d/${vendor.repo}/tree/main/${vendor.folder}` }; } catch { /* listed but not published: the next one */ }
  }
  throw new Error(`${vendor.name}: no bundle found`);
}

/* ---------- resolving presets ---------- */

/** Merges a preset with what it inherits: parents in order, then its own values. */
function resolver(own, parentsOf) {
  const done = new Map();
  const resolve = (name, trail = []) => {
    if (done.has(name)) return done.get(name);
    const values = own(name);
    if (!values || trail.includes(name)) return {};
    const merged = Object.assign({}, ...parentsOf(values).map((p) => resolve(p, [...trail, name])), values);
    delete merged.inherits;
    done.set(name, merged);
    return merged;
  };
  return resolve;
}

/** The FFF printers of a PrusaSlicer bundle: [{ name, model, nozzle, values }]. */
function prusaPresets(text) {
  const sections = parseConfigText(text);
  const printers = new Map(), models = new Map();
  for (const s of sections) {
    if (s.kind === 'printer') printers.set(s.name, s.values);
    if (s.kind === 'printer_model') models.set(s.name, s.values);
  }
  const resolve = resolver((n) => printers.get(n), (v) => String(v.inherits ?? '').split(';').map((p) => p.trim().replace(/^"|"$/g, '')).filter(Boolean));
  const out = [];
  for (const name of printers.keys()) {
    if (name.startsWith('*')) continue; // abstract: only inherited from
    const values = resolve(name);
    const model = models.get(values.printer_model);
    if ((values.printer_technology ?? 'FFF') !== 'FFF' || (model && (model.technology ?? 'FFF') !== 'FFF')) continue;
    // a preset that names no nozzle has PrusaSlicer's default one; "&&" is how the .ini writes "&" in a menu name
    if (num(values.nozzle_diameter) === null) values.nozzle_diameter = '0.4';
    out.push({ name, model: String(model?.name ?? values.printer_model ?? name).replace(/&&/g, '&'), modelId: values.printer_model ?? name, nozzle: num(values.nozzle_diameter), values });
  }
  return out;
}

/** Every Bambu Lab printer preset: [{ name, model, nozzle, values }]. */
async function bambuPresets() {
  const index = JSON.parse(await fetchText(`${BAMBU.base}/BBL.json`));
  const paths = new Map(index.machine_list.map((m) => [m.name, m.sub_path]));
  const raw = new Map();
  const load = async (name) => {
    if (raw.has(name) || !paths.has(name)) return;
    const json = JSON.parse(await fetchText(`${BAMBU.base}/BBL/${paths.get(name).split('/').map(encodeURIComponent).join('/')}`));
    raw.set(name, json);
    for (const parent of [json.inherits, ...(json.include ?? [])]) if (parent) await load(parent);
  };
  for (const m of index.machine_list) await load(m.name);
  // a Bambu preset takes what it inherits, then the templates it includes (its start and end G-code live there)
  const resolve = resolver((n) => raw.get(n), (v) => [...(v.inherits ? [v.inherits] : []), ...(v.include ?? [])]);
  const out = [];
  for (const [name, json] of raw) {
    if (String(json.instantiation) !== 'true' || json.type !== 'machine') continue;
    const values = resolve(name);
    out.push({ name, model: values.printer_model ?? name, modelId: values.printer_model ?? name, nozzle: num(values.nozzle_diameter), values });
  }
  return { version: index.version, presets: out };
}

/* ---------- writing the library ---------- */

/**
 * Keeps the presets in the nozzle sizes offered, one per model and nozzle (the first the vendor lists), then converts
 * them. A model sold with none of those sizes (LulzBot's 0.5 mm) keeps the one nearest 0.4 mm.
 */
function convert(vendor, presets, source) {
  // the popular models only (unless --all), in the order POPULAR lists them, each one's nozzles smallest first
  const popular = ALL ? null : POPULAR[vendor.id];
  const rank = (p) => (popular ? popular.indexOf(p.model) : 0);
  // multi-material and high-flow add-on variants are kept out: one plain printer per model and nozzle
  const plain = presets.filter((p) => !/\b(MMU\d?S?|HF\d*(\.\d+)?|ERCF|multi[- ]?material)\b/i.test(p.name) && rank(p) >= 0)
    .sort((a, b) => rank(a) - rank(b) || (a.nozzle ?? 0) - (b.nozzle ?? 0));
  const offered = new Set(plain.filter((p) => NOZZLES.includes(p.nozzle)).map((p) => p.modelId));
  const nearest = new Map();
  for (const p of plain) {
    if (offered.has(p.modelId) || p.nozzle === null) continue;
    const best = nearest.get(p.modelId);
    if (!best || Math.abs(p.nozzle - 0.4) < Math.abs(best - 0.4)) nearest.set(p.modelId, p.nozzle);
  }
  const seen = new Set();
  const machines = [], entries = [], skipped = [];
  for (const p of plain) {
    if (!(offered.has(p.modelId) ? NOZZLES.includes(p.nozzle) : nearest.get(p.modelId) === p.nozzle)) continue;
    const key = `${p.modelId}|${p.nozzle}`;
    if (seen.has(key)) continue;
    try {
      const id = slug(p.name);
      const { machine, notes } = machineFromSettings(p.values, { id, name: p.name, source: `${vendor.name} profile from ${source}` });
      machine.vendor = vendor.name;
      machine.model = p.model;
      const allNotes = [...notes, ...(VENDOR_NOTES[vendor.id] ? [VENDOR_NOTES[vendor.id]] : [])];
      if (allNotes.length) machine.notes = allNotes;
      seen.add(key);
      machines.push(machine);
      entries.push({ id, vendor: vendor.id, name: p.name, model: p.model, nozzle: p.nozzle, bed: [machine.bed.width, machine.bed.depth, machine.bed.max_z] });
    } catch (e) {
      skipped.push(`${p.name}: ${e.message}`);
    }
  }
  return { machines, entries, skipped };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const index = { generated: new Date().toISOString().slice(0, 10), note: 'Generated by tools/import-vendor-profiles.mjs: run it again to update, do not edit.', vendors: [], machines: [] };
  const report = [];
  const write = (vendor, version, url, result) => {
    fs.writeFileSync(path.join(OUT, `${vendor.id}.json`), `${JSON.stringify({ vendor: vendor.name, version, source: url, machines: result.machines })}\n`);
    index.vendors.push({ id: vendor.id, name: vendor.name, file: `${vendor.id}.json`, version, source: url, printers: result.machines.length });
    index.machines.push(...result.entries);
    report.push(`${vendor.name.padEnd(16)} ${String(result.machines.length).padStart(3)} printers${result.skipped.length ? `, ${result.skipped.length} skipped` : ''}`);
    for (const s of result.skipped) report.push(`    skipped ${s}`);
  };

  const bambu = await bambuPresets();
  const bambuUrl = 'https://github.com/bambulab/BambuStudio/tree/master/resources/profiles/BBL';
  write(BAMBU, bambu.version, bambuUrl, convert(BAMBU, bambu.presets, `Bambu Studio ${bambu.version}`));
  for (const vendor of PRUSA_VENDORS.filter((v) => ALL || POPULAR[v.id])) {
    try {
      const bundle = await latestBundle(vendor);
      write(vendor, bundle.version, bundle.url, convert(vendor, prusaPresets(bundle.text), `PrusaSlicer ${vendor.folder} ${bundle.version}`));
    } catch (e) {
      report.push(`${vendor.name}: ${e.message}`);
    }
  }
  // one printer to a line: small to load, and a change to the library reads as a short diff
  const lines = (list) => list.map((x) => `  ${JSON.stringify(x)}`).join(',\n');
  fs.writeFileSync(path.join(OUT, 'index.json'), `{\n "generated": ${JSON.stringify(index.generated)},\n "note": ${JSON.stringify(index.note)},\n "vendors": [\n${lines(index.vendors)}\n ],\n "machines": [\n${lines(index.machines)}\n ]\n}\n`);
  // a vendor no longer built leaves no file behind
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json') && f !== 'index.json' && !index.vendors.some((v) => v.file === f)) fs.unlinkSync(path.join(OUT, f));
  console.log(report.join('\n'));
  console.log(`\n${index.machines.length} printers from ${index.vendors.length} vendors in profiles/library/${ALL ? '' : ' (the popular ones; --all for every vendor)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
