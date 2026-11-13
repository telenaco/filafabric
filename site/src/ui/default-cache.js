import { defaultCacheIdentity, referenceCacheIdentity, parseDefaultResult } from '../engine/default-cache-format.js';
import { PRECOMPUTED_REVISION } from './precomputed-version.js?v=20261112-studio-cleanup';

const abort = signal => { if (signal?.aborted) throw new DOMException('Build cancelled', 'AbortError'); };
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');

/** Lazy on-demand downloads; compressed bytes are cached, never mutable result objects. */
export function createDefaultCache({ revision = PRECOMPUTED_REVISION, fetcher = (...args) => fetch(...args), digest = sha256, maxBytes = 12 * 1024 * 1024 } = {}) {
  let manifestPromise = null, storedBytes = 0;
  const files = new Map();
  const base = new URL('../../precomputed/', import.meta.url);
  const remember = (key, bytes) => {
    if (bytes.byteLength > maxBytes) return;
    while (files.size && storedBytes + bytes.byteLength > maxBytes) { const first = files.keys().next().value; storedBytes -= files.get(first).byteLength; files.delete(first); }
    files.set(key, bytes); storedBytes += bytes.byteLength;
  };
  return {
    async load(input, { signal, reference = false } = {}) {
      abort(signal);
      // Other profiles/settings remain supported by the normal worker. No artwork is sent anywhere by this lookup.
      if (!revision || !globalThis.DecompressionStream || input.width !== 100 || input.height !== 100 || input.vector || input.outline || input.image || input.regions?.length
        || !reference && (input.machine?.id !== 'prusa-mk3s' || input.material?.id !== 'filaflex-95-foamy')) return null;
      try {
        const requestKey = await digest(new TextEncoder().encode(reference ? referenceCacheIdentity(input) : defaultCacheIdentity(input)));
        manifestPromise ??= fetcher(new URL(`index.json?v=${revision}`, base), { cache: 'force-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
        const manifest = await manifestPromise;
        abort(signal);
        const available = manifest?.format === 1 && manifest.revision === revision ? manifest.entries ?? {} : {};
        const [key, entry] = reference ? Object.entries(available).find(([, e]) => e.referenceKey === requestKey) ?? [] : [requestKey, available[requestKey]];
        if (!entry || entry.design !== input.design || !/^[a-f0-9]{16}\/[a-z0-9-]+\.[a-f0-9]{16}\.json\.gz$/.test(entry.file)) return null;
        let bytes = files.get(key);
        if (bytes) { files.delete(key); files.set(key, bytes); }
        else {
          const response = await fetcher(new URL(entry.file, base), { signal, cache: 'force-cache' });
          if (!response.ok) return null;
          bytes = new Uint8Array(await response.arrayBuffer());
        }
        abort(signal);
        // Some hosts decode Content-Encoding automatically; direct .gz files retain their gzip header.
        const plain = bytes[0] === 31 && bytes[1] === 139
          ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()) : bytes;
        if (await digest(plain) !== entry.dataSha256) return null;
        const payload = parseDefaultResult(new TextDecoder().decode(plain));
        abort(signal);
        if (payload.format !== 1 || payload.revision !== revision || payload.inputKey !== key || typeof payload.result?.gcode !== 'string' || !payload.result.moves?.length) return null;
        if (!files.has(key)) remember(key, bytes);
        return reference ? { ...payload.result, referencePreview: true } : payload.result;
      } catch (error) { abort(signal); return null; }
    },
  };
}

export const defaultCache = createDefaultCache();
