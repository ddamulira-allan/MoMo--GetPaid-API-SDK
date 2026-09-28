/**
 * rename-cjs.mjs
 * Post-build script: renames all .js → .cjs and .d.ts → .d.cts in dist/cjs/
 * so Node.js can correctly identify the CommonJS output in a dual ESM/CJS package.
 *
 * Also rewrites internal require() calls inside .cjs files to use the new .cjs extension.
 */

import { readdirSync, renameSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, extname } from 'path';

const CJS_DIR = fileURLToPath(new URL('../dist/cjs', import.meta.url));

/**
 * Recursively collect all files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(CJS_DIR);

// ── Step 1: rewrite require() calls inside .js files to use .cjs ─────────────
for (const file of files) {
  if (extname(file) !== '.js') continue;
  let src = readFileSync(file, 'utf8');
  // Replace require('./foo.js') → require('./foo.cjs')
  src = src.replace(/require\((['"])(\.{1,2}\/[^'"]+)\.js\1\)/g, "require($1$2.cjs$1)");
  writeFileSync(file, src, 'utf8');
}

// ── Step 2: rename .js → .cjs and .d.ts → .d.cts ────────────────────────────
// Sort longest paths first so we don't rename a parent before its children
const sorted = [...files].sort((a, b) => b.length - a.length);

for (const file of sorted) {
  if (file.endsWith('.d.ts')) {
    const newPath = file.slice(0, -5) + '.d.cts';
    renameSync(file, newPath);
  } else if (file.endsWith('.d.ts.map')) {
    const newPath = file.slice(0, -9) + '.d.cts.map';
    renameSync(file, newPath);
  } else if (file.endsWith('.js.map')) {
    const newPath = file.slice(0, -7) + '.cjs.map';
    renameSync(file, newPath);
  } else if (file.endsWith('.js')) {
    const newPath = file.slice(0, -3) + '.cjs';
    renameSync(file, newPath);
  }
}

console.log('✅ CJS output renamed: .js → .cjs, .d.ts → .d.cts');
