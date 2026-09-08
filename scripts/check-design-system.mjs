/**
 * The gate the design system did not have.
 *
 *   node scripts/check-design-system.mjs
 *
 * The stylesheet drifted once already: twenty different spacing values and
 * eleven type sizes, because every number was chosen where it was written and
 * nothing ever objected. Writing the scale down fixed that day; it does not
 * stop tomorrow. This does.
 *
 * Three checks, in the order they matter:
 *
 *   1. No raw spacing or type numbers. Every gap, margin, padding and
 *      font-size must name a token. The exceptions are listed below and each
 *      one says why it is not a choice.
 *   2. No colour outside the palette. A hex or rgb() written inline is a
 *      seventh hue nobody named.
 *   3. The token inventory matches its snapshot. Adding or removing a token
 *      is fine — leaving the published design system describing a set that no
 *      longer exists is not, and this is what makes that impossible to miss.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = join(ROOT, 'src/styles/global.css');
const SNAPSHOT = join(ROOT, 'scripts/design-tokens.json');

const css = readFileSync(CSS, 'utf8');
const lines = css.split('\n');
const problems = [];

// ── 1. Spacing and type must name a token ────────────────────────────────────

/**
 * Numbers that are not scale steps, and are therefore allowed raw.
 *
 * Each is a constraint rather than a choice, which is the whole test for
 * belonging here: 44 is where macOS puts its window buttons, 16 is the size
 * below which iOS zooms a focused input, 1 and 2 are strokes and optical
 * nudges rather than space. Adding to this list without a reason of that kind
 * is how the exception list becomes the scale.
 */
const ALLOWED_RAW = new Set(['0', '1px', '2px', '44px', '16px', '100%', 'auto', 'inherit']);
const SPACING_PROPS = /^\s*(gap|row-gap|column-gap|margin|margin-top|margin-bottom|margin-left|margin-right|padding|padding-top|padding-bottom|padding-left|padding-right):\s*([^;]+);/;

lines.forEach((line, i) => {
  const n = i + 1;
  if (line.trim().startsWith('/*') || line.trim().startsWith('*')) return;

  const space = line.match(SPACING_PROPS);
  if (space) {
    for (const part of space[2].trim().split(/\s+/)) {
      if (!/^-?\d+(\.\d+)?px$/.test(part)) continue;
      if (ALLOWED_RAW.has(part)) continue;
      problems.push({
        line: n,
        text: line.trim(),
        why: `${space[1]} uses a raw ${part}. Name a spacing step (--s-1 … --s-6), `
          + 'or if it is a fixed platform constant, add it to ALLOWED_RAW with the reason.',
      });
    }
  }

  const type = line.match(/^\s*font-size:\s*([0-9.]+)px/);
  if (type) {
    problems.push({
      line: n,
      text: line.trim(),
      why: `font-size uses a raw ${type[1]}px. Use a type role `
        + '(--t-caption … --t-hero, or --t-input for a field).',
    });
  }
});

// ── 2. Colour must come from the palette ─────────────────────────────────────

/** Where literal colour is legitimate: the palette itself, and nowhere else. */
const paletteStart = css.indexOf(':root {');
const paletteEnd = css.indexOf('body {');

lines.forEach((line, i) => {
  const n = i + 1;
  const at = lines.slice(0, i).join('\n').length;
  // Inside the token blocks a literal value is the definition, not a use.
  if (at > paletteStart && at < paletteEnd) return;
  if (line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
  if (line.includes('--')) return;

  const literal = line.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/);
  if (literal && !line.includes('rgba(0, 0, 0, 0)') && !line.includes('transparent')) {
    problems.push({
      line: n,
      text: line.trim(),
      why: `Literal colour ${literal[0]} outside the palette. Use a semantic token `
        + '(--primary, --success, --warning, --danger, --info) or a surface/ink token.',
    });
  }
});

// ── 3. The inventory must match its snapshot ─────────────────────────────────

const tokens = [...css.matchAll(/^\s{2}(--[a-z0-9-]+):\s*([^;]+);/gm)]
  .reduce((acc, [, name, value]) => {
    // A token is declared once per theme; the first is the light-mode value.
    if (!(name in acc)) acc[name] = value.trim();
    return acc;
  }, {});

const inventory = Object.keys(tokens).sort();
const writing = process.argv.includes('--write');

if (writing) {
  writeFileSync(SNAPSHOT, `${JSON.stringify({ tokens: inventory }, null, 2)}\n`);
  console.log(`snapshot written — ${inventory.length} tokens`);
} else if (!existsSync(SNAPSHOT)) {
  problems.push({
    line: 0,
    text: 'scripts/design-tokens.json',
    why: 'No token snapshot. Run with --write once to record the current set.',
  });
} else {
  const before = JSON.parse(readFileSync(SNAPSHOT, 'utf8')).tokens;
  const added = inventory.filter((t) => !before.includes(t));
  const removed = before.filter((t) => !inventory.includes(t));
  if (added.length || removed.length) {
    problems.push({
      line: 0,
      text: 'token inventory',
      why: [
        added.length ? `added: ${added.join(', ')}` : '',
        removed.length ? `removed: ${removed.join(', ')}` : '',
        'Update the published design system to match, then re-run with --write.',
      ].filter(Boolean).join('  ·  '),
    });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

if (!problems.length) {
  console.log(`design system: clean — ${inventory.length} tokens, no raw values`);
  process.exit(0);
}

console.log(`\ndesign system: ${problems.length} problem${problems.length > 1 ? 's' : ''}\n`);
for (const p of problems) {
  const where = p.line ? `global.css:${p.line}` : p.text;
  console.log(`  ${where}`);
  if (p.line) console.log(`    ${p.text}`);
  console.log(`    → ${p.why}\n`);
}
process.exit(1);
