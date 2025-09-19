#!/usr/bin/env node
// Counts files in a directory (defaults to ./src) while excluding
// common dependency and build/cache directories.

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv[2] || 'src';
const root = path.resolve(process.cwd(), rootArg);

// Exclude these directories anywhere in the path
const EXCLUDE_DIR_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.cache',
  '.parcel-cache',
  '.turbo',
  '.vite',
  '.vercel',
  'tmp',
  'temp'
];

function isExcludedDir(fullPath) {
  const parts = fullPath.split(path.sep);
  return parts.some(p => EXCLUDE_DIR_PATTERNS.includes(p));
}

async function countFiles(dir) {
  if (isExcludedDir(dir)) return 0;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    // Directory might not exist
    if (err && err.code === 'ENOENT') return 0;
    throw err;
  }

  let count = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isExcludedDir(full)) continue;
      count += await countFiles(full);
    } else if (entry.isFile()) {
      count += 1;
    } else if (entry.isSymbolicLink()) {
      // Resolve symlink target and count if it's a file
      try {
        const st = await stat(full);
        if (st.isFile()) count += 1;
        if (st.isDirectory() && !isExcludedDir(full)) count += await countFiles(full);
      } catch {
        // ignore broken links
      }
    }
  }
  return count;
}

const main = async () => {
  const start = Date.now();
  const total = await countFiles(root);
  const ms = Date.now() - start;
  const rel = path.relative(process.cwd(), root) || root;
  console.log(`Files under ${rel} (excluding deps/caches): ${total}`);
  console.log(`Time: ${ms} ms`);
};

main().catch(err => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});

