// The printers and filaments the studio knows: the ones in the profiles folder, and the ones a person added in the
// printer setup (kept in this browser). Both are read with the same importer, so a PrusaSlicer or Bambu Studio export
// works wherever it is put.
import { importProfiles, ProfileImportError } from '../engine/profile-import.js';
import { validateMachine, validateMaterial } from '../engine/profiles.js';

const KEY = 'filafabric:profiles';
const hasExtension = (name) => /\.[a-z0-9]+$/i.test(name);

export class ProfileStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.machines = new Map();
    this.materials = new Map();
    /** Why a file in the folder could not be read: [{ file, message }] */
    this.problems = [];
    this.origins = new Map(); // `${kind}:${id}` -> 'folder' | 'user' | 'library'
    this.notes = new Map(); // `${kind}:${id}` -> [text]
    this.user = { machines: [], materials: [] };
    /** The printer library's index ({ vendors, machines }), or null when there is none. */
    this.library = null;
    this.libraryBase = 'profiles/library';
    this.vendorFiles = new Map(); // vendor id -> the promise of its file
  }

  /**
   * The printer library (profiles/library, made by tools/import-vendor-profiles.mjs from the slicers' vendor profiles):
   * only its index is read here, a few hundred names; a vendor's file is read when one of its printers is chosen.
   */
  async loadLibrary(base = 'profiles/library') {
    this.libraryBase = base;
    try {
      const res = await fetch(`${base}/index.json`);
      this.library = res.ok ? await res.json() : null;
    } catch {
      this.library = null;
    }
  }

  libraryEntry(id) {
    return this.library?.machines.find((m) => m.id === id) ?? null;
  }

  /**
   * Makes a printer of the library usable: its vendor's file is read (once) and its printers join the known ones.
   * @returns the printer's profile, or null when it is neither known nor in the library
   */
  async useLibrary(id) {
    if (this.machines.has(id)) return this.machines.get(id);
    const entry = this.libraryEntry(id);
    const vendor = entry && this.library.vendors.find((v) => v.id === entry.vendor);
    if (!vendor) return null;
    if (!this.vendorFiles.has(vendor.id)) {
      this.vendorFiles.set(vendor.id, fetch(`${this.libraryBase}/${vendor.file}`).then((r) => {
        if (!r.ok) throw new Error(`${vendor.file} could not be read (${r.status})`);
        return r.json();
      }));
    }
    let file;
    try {
      file = await this.vendorFiles.get(vendor.id);
    } catch (e) {
      this.vendorFiles.delete(vendor.id); // a failed read can be tried again
      throw e;
    }
    for (const machine of file.machines ?? []) {
      if (this.machines.has(machine.id) || validateMachine(machine).length) continue;
      this.machines.set(machine.id, machine);
      this.origins.set(`machines:${machine.id}`, 'library');
      this.notes.set(`machines:${machine.id}`, machine.notes ?? []);
    }
    return this.machines.get(id) ?? null;
  }

  map(kind) {
    return kind === 'machines' ? this.machines : this.materials;
  }

  isUser(kind, id) {
    return this.origins.get(`${kind}:${id}`) === 'user';
  }

  notesFor(kind, id) {
    return this.notes.get(`${kind}:${id}`) ?? [];
  }

  #take(got, origin) {
    for (const kind of ['machines', 'materials']) {
      for (const profile of got[kind]) {
        this.map(kind).set(profile.id, profile);
        this.origins.set(`${kind}:${profile.id}`, origin);
        this.notes.set(`${kind}:${profile.id}`, got.notes.length ? got.notes : profile.import_notes ?? []);
      }
    }
  }

  /** Every profile file the folder's index lists. Entries are file names; a bare id means `<id>.json`. */
  async loadFolders(base = 'profiles') {
    const res = await fetch(`${base}/index.json`);
    if (!res.ok) throw new Error('the profiles folder has no index.json');
    const index = await res.json();
    for (const kind of ['machines', 'materials']) {
      for (const entry of index[kind] ?? []) {
        const file = hasExtension(entry) ? entry : `${entry}.json`;
        try {
          const r = await fetch(`${base}/${kind}/${file}`);
          if (!r.ok) throw new ProfileImportError([`the file is listed but could not be read (${r.status})`]);
          this.#take(importProfiles(await r.text(), file), 'folder');
        } catch (e) {
          this.problems.push({ file: `${kind}/${file}`, message: e.message });
        }
      }
    }
  }

  loadUser() {
    let saved = null;
    try { saved = JSON.parse(this.storage?.getItem(KEY) ?? 'null'); } catch { saved = null; }
    for (const kind of ['machines', 'materials']) {
      const check = kind === 'machines' ? validateMachine : validateMaterial;
      for (const profile of Array.isArray(saved?.[kind]) ? saved[kind] : []) {
        if (profile && typeof profile === 'object' && check(profile).length === 0) {
          this.user[kind].push(profile);
          this.#take({ machines: kind === 'machines' ? [profile] : [], materials: kind === 'materials' ? [profile] : [], notes: [] }, 'user');
        }
      }
    }
  }

  #persist() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.user)); } catch { /* storage unavailable: the profile lasts until the page closes */ }
  }

  /** Reads a file the person chose and keeps what is in it. @returns { machines, materials, notes } */
  add(text, filename) {
    const got = importProfiles(text, filename);
    for (const kind of ['machines', 'materials']) {
      for (const profile of got[kind]) {
        // Startup substitutions and guessed defaults must still be visible after this browser is reopened.
        if (got.notes.length) profile.import_notes = [...got.notes];
        this.user[kind] = [...this.user[kind].filter((p) => p.id !== profile.id), profile];
      }
    }
    this.#take(got, 'user');
    this.#persist();
    return got;
  }

  /** Forgets a profile that was added here. Folder profiles are removed by deleting their file. */
  remove(kind, id) {
    if (!this.isUser(kind, id)) return false;
    this.user[kind] = this.user[kind].filter((p) => p.id !== id);
    this.map(kind).delete(id);
    this.origins.delete(`${kind}:${id}`);
    this.notes.delete(`${kind}:${id}`);
    this.#persist();
    return true;
  }
}
