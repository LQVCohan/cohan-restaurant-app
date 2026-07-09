import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const host = process.env.MONGO_HOST || '127.0.0.1';
const port = Number(process.env.MONGO_PORT || 27017);
const dataDir = path.resolve(
  process.env.MONGO_DBPATH ||
    (isWindows ? 'C:\\data\\db' : path.join(os.homedir(), '.cohan', 'mongodb', 'data')),
);

function isPortOpen(targetHost, targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: targetHost, port: targetPort });
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function versionScore(name) {
  return name
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersionsDesc(left, right) {
  const a = versionScore(left);
  const b = versionScore(right);
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (b[i] || 0) - (a[i] || 0);
    if (diff !== 0) return diff;
  }
  return right.localeCompare(left);
}

function findWindowsMongod() {
  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    'C:\\Program Files',
  ].filter(Boolean);

  for (const root of roots) {
    const serverRoot = path.join(root, 'MongoDB', 'Server');
    if (!fs.existsSync(serverRoot)) continue;

    const versions = fs
      .readdirSync(serverRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareVersionsDesc);

    for (const version of versions) {
      const candidate = path.join(serverRoot, version, 'bin', 'mongod.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

function findMongod() {
  const explicit = process.env.MONGOD_BIN?.trim();
  if (explicit) return explicit;
  if (isWindows) return findWindowsMongod();
  return 'mongod';
}

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`❌ Invalid MONGO_PORT: ${process.env.MONGO_PORT}`);
  process.exit(1);
}

if (await isPortOpen(host, port)) {
  console.log(`✅ MongoDB already running at ${host}:${port}`);
  process.exit(0);
}

const mongodBin = findMongod();
if (!mongodBin) {
  console.error('❌ Cannot find mongod.exe. Install MongoDB Server or set MONGOD_BIN.');
  process.exit(1);
}

fs.mkdirSync(dataDir, { recursive: true });

const args = [
  '--dbpath',
  dataDir,
  '--bind_ip',
  host,
  '--port',
  String(port),
  ...process.argv.slice(2),
];

console.log(`▶️  Starting MongoDB: ${mongodBin}`);
console.log(`📁 Data directory: ${dataDir}`);
console.log(`🌐 Listening: ${host}:${port}`);
console.log('Press Ctrl+C to stop MongoDB.');

const child = spawn(mongodBin, args, { stdio: 'inherit' });
child.on('error', (error) => {
  console.error(`❌ Failed to start MongoDB: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 0);
});
