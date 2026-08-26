#!/usr/bin/env node
/**
 * Browser-suite runner.
 *
 * The end-to-end suites need three things the unit suites do not: a production
 * build, something serving it over http (service workers refuse to register on
 * file://), and a real browser. This builds, serves, runs, and tears down.
 *
 *   npm run test:e2e
 *
 * PLAYWRIGHT_CHROMIUM_PATH overrides the browser binary if you already have one.
 */

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PORT = process.env.PREVIEW_PORT || '4173';
const URL = `http://localhost:${PORT}/`;

const sh = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Preview server never came up on ${URL}`);
}

console.log('building...');
await sh(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'ignore' });

const preview = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'preview', '--', '--port', PORT, '--strictPort'],
  { cwd: ROOT, stdio: 'ignore' },
);

let failed = false;
try {
  await waitForServer();
  console.log(`serving ${URL}\n`);

  const dir = path.join(ROOT, 'test', 'e2e');
  const suites = (await readdir(dir))
    .filter((f) => f.endsWith('.mjs') && f !== 'run.mjs')
    .sort();

  for (const suite of suites) {
    console.log(`--- test/e2e/${suite}`);
    try {
      await sh(process.execPath, [path.join(dir, suite)], { env: { ...process.env, PREVIEW_URL: URL } });
    } catch (error) {
      console.error(`    ${error.message}`);
      failed = true;
    }
  }
} finally {
  preview.kill();
}

console.log(failed ? '\ne2e: FAILURES' : '\ne2e: all green');
process.exit(failed ? 1 : 0);
