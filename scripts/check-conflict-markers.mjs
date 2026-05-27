import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MARKERS = {
  start: '<<<<<<<',
  middle: '=======',
  end: '>>>>>>>',
};

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
]);

function isExcludedPath(filePath) {
  return filePath.split('/').some((segment) => EXCLUDED_DIRS.has(segment));
}

function getTrackedFiles() {
  const output = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  return output.split('\n').filter(Boolean).filter((file) => !isExcludedPath(file));
}

function toLines(content) {
  return content.split(/\r?\n/);
}

function startsWithMarker(line, marker) {
  return line.startsWith(marker);
}

function findConflictGroup(lines) {
  let startLine = null;
  let middleLine = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (startLine === null) {
      if (startsWithMarker(line, MARKERS.start)) {
        startLine = i + 1;
      }
      continue;
    }

    if (middleLine === null) {
      if (startsWithMarker(line, MARKERS.middle)) {
        middleLine = i + 1;
      } else if (startsWithMarker(line, MARKERS.start)) {
        startLine = i + 1;
      }
      continue;
    }

    if (startsWithMarker(line, MARKERS.end)) {
      return {
        startLine,
        middleLine,
        endLine: i + 1,
        startText: lines[startLine - 1],
        middleText: lines[middleLine - 1],
        endText: line,
      };
    }

    if (startsWithMarker(line, MARKERS.start)) {
      startLine = i + 1;
      middleLine = null;
    }
  }

  return null;
}

function readTextFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    if (content.includes('\u0000')) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

const conflicts = [];
const files = getTrackedFiles();

for (const filePath of files) {
  const content = readTextFile(filePath);
  if (content === null) continue;

  const conflictGroup = findConflictGroup(toLines(content));
  if (conflictGroup) {
    conflicts.push({ filePath, ...conflictGroup });
  }
}

if (conflicts.length > 0) {
  console.error('Unresolved merge conflict markers found:\n');

  for (const conflict of conflicts) {
    console.error(conflict.filePath);
    console.error(`  L${conflict.startLine}: ${conflict.startText}`);
    console.error(`  L${conflict.middleLine}: ${conflict.middleText}`);
    console.error(`  L${conflict.endLine}: ${conflict.endText}`);
    console.error('');
  }

  console.error('Please resolve the conflict markers before merging.');
  process.exit(1);
}

console.log('No unresolved merge conflict markers found.');
