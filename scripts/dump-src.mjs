#!/usr/bin/env node
// Dump or list project source files to help share code context.
// Usage:
//   node scripts/dump-src.mjs [dir] [--list] [--out path] [--all-text]
// Examples:
//   node scripts/dump-src.mjs --list > filelist.txt
//   node scripts/dump-src.mjs src --out src_dump.txt
//   node scripts/dump-src.mjs src --out src_dump.txt --all-text

import fs from 'node:fs';
import { readdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const rootArg = args.find(a => !a.startsWith('--')) || 'src';
const listOnly = args.includes('--list');
const outIdx = args.indexOf('--out');
const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
const allText = args.includes('--all-text');

const root = path.resolve(process.cwd(), rootArg);

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage',
  '.cache', '.parcel-cache', '.turbo', '.vite', '.vercel', 'tmp', 'temp'
]);

// By default, only dump likely text/code files to keep output readable.
const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs', '.json',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm', '.md', '.markdown', '.txt', '.env', '.yml', '.yaml', '.svg'
]);

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.pdf', '.zip',
  '.gz', '.tar', '.7z', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mov',
  '.webm', '.mp3', '.wav', '.dll', '.exe'
]);

function isExcludedDir(fullPath) {
  const parts = fullPath.split(path.sep);
  return parts.some(p => EXCLUDE_DIRS.has(p));
}

function shouldDumpFile(filePath) {
  if (allText) return true;
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXT.has(ext)) return false;
  // If no extension, assume small text; otherwise allow only known text/code ext
  if (!ext) return true;
  return TEXT_EXT.has(ext);
}

async function* walk(dir) {
  if (isExcludedDir(dir)) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e && e.code === 'ENOENT') return; // missing dir ok
    throw e;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isExcludedDir(full)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function run() {
  const start = Date.now();
  const stream = outPath ? fs.createWriteStream(outPath) : process.stdout;

  let count = 0;
  for await (const file of walk(root)) {
    const rel = path.relative(process.cwd(), file);
    if (listOnly) {
      stream.write(`${rel}\n`);
      count++;
      continue;
    }

    if (!shouldDumpFile(file)) {
      // still list path but mark skipped
      stream.write(`=== FILE (skipped binary/asset): ${rel} ===\n\n`);
      count++;
      continue;
    }

    let content = '';
    try {
      // Guard against extremely large files (>2MB)
      const st = await stat(file);
      if (st.size > 2 * 1024 * 1024) {
        stream.write(`=== FILE (skipped >2MB): ${rel} (${st.size} bytes) ===\n\n`);
        count++;
        continue;
      }
      content = await readFile(file, 'utf8');
    } catch (e) {
      stream.write(`=== FILE (read error): ${rel} ===\n${String(e)}\n\n`);
      count++;
      continue;
    }
    stream.write(`=== FILE: ${rel} ===\n`);
    // Ensure trailing newline for readability
    if (!content.endsWith('\n')) content += '\n';
    stream.write(content + '\n');
    count++;
  }

  const ms = Date.now() - start;
  if (outPath) {
    stream.end(() => {
      console.log(`Dumped ${count} entries from ${path.relative(process.cwd(), root)} to ${outPath} in ${ms} ms`);
    });
  } else {
    console.error(`Dumped ${count} entries from ${path.relative(process.cwd(), root)} in ${ms} ms`);
  }
}

run().catch(err => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});

