// Swatch records (docs/swatches/*.md, from TEMPLATE.md): what a printed piece showed. Pure functions, no file access, so the
// Tested badge can be checked in Node and the same rules read by any tool.

const FIELD = /^- \*\*([^*]+?):\*\*[ \t]*(.*)$/gm;

/** The labelled fields of one record, keyed by their label in lower case. */
export function parseSwatchRecord(markdown) {
  const fields = {};
  for (const [, label, value] of String(markdown ?? '').matchAll(FIELD)) fields[label.trim().toLowerCase()] = value.trim();
  const verdict = /^good$/i.test(fields.verdict ?? '') ? 'good' : /^usable with notes$/i.test(fields.verdict ?? '') ? 'usable' : /^failed$/i.test(fields.verdict ?? '') ? 'failed' : null;
  const card = (fields['card id / variant'] ?? '').split(/[\s/,]+/).find(Boolean) ?? '';
  return {
    swatchCode: fields['swatch code'] ?? '', card, settingsHash: fields['settings hash'] ?? '', printedBy: fields['printed by'] ?? '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(fields['date (yyyy-mm-dd)'] ?? '') ? fields['date (yyyy-mm-dd)'] : '',
    printStatus: fields['print status'] ?? '', verdict, approvedBy: fields['approved by'] ?? '',
  };
}

/** A record counts for the badge only when it is a good print, dated, signed off by the owner and names its card. */
export function qualifiesForTested(record) {
  return record.verdict === 'good' && record.printStatus.toLowerCase() === 'success' && !!record.card && !!record.date && /^luis\b/i.test(record.approvedBy);
}

/**
 * @param designs  registry cards ({ id, state, status, hidden })
 * @param records  parsed records
 * @returns {string[]} what is wrong: a Tested card without a qualifying record, or a record naming a card that is not there
 */
export function testedProblems(designs, records) {
  const problems = [], ids = new Set(designs.map((card) => card.id));
  for (const card of designs.filter((entry) => entry.status === 'ready' && entry.state === 'tested')) {
    if (!records.some((record) => record.card === card.id && qualifiesForTested(record))) problems.push(`${card.id} is marked Tested without a good, approved swatch record.`);
  }
  for (const record of records) if (record.card && !ids.has(record.card)) problems.push(`A swatch record names ${record.card}, which is not a card.`);
  return problems;
}
