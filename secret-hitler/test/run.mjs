#!/usr/bin/env node
/**
 * Test runner.
 *
 * The suites are plain Node scripts: they print `PASS`/`FAIL` lines and set a
 * non-zero exit code if anything failed. No framework, no config, no globals —
 * which means they run anywhere Node runs and there is nothing to keep in step
 * with a toolchain.
 *
 * This runner just finds them, compiles the JSX ones through esbuild, runs each
 * in its own process, and adds up the results.
 *
 *   node test/run.mjs             every headless suite
 *   node test/run.mjs storage     only suites whose path matches "storage"
 */

import { spawn } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { build } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILTER = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const DIRS = ['unit', 'ui'];

async function collect() {
  const found = [];
  for (const dir of DIRS) {
    const full = path.join(ROOT, 'test', dir);
    for (const entry of (await readdir(full)).sort()) {
      if (!/\.(mjs|jsx)$/.test(entry)) continue;
      const rel = path.join('test', dir, entry);
      if (FILTER.length && !FILTER.some((f) => rel.includes(f))) continue;
      found.push({ rel, abs: path.join(full, entry), jsx: entry.endsWith('.jsx') });
    }
  }
  return found;
}

/** JSX suites are bundled first; React and jsdom stay external and resolve at runtime. */
async function compile(suite, outDir) {
  if (!suite.jsx) return suite.abs;
  const outfile = path.join(outDir, `${path.basename(suite.rel, '.jsx')}.mjs`);
  await build({
    entryPoints: [suite.abs],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'jsdom', 'playwright'],
    logLevel: 'silent',
  });
  return outfile;
}

function run(file, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { cwd, env: process.env });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
      const pass = (out.match(/^PASS\b/gm) ?? []).length;
      const fail = (out.match(/^FAIL\b/gm) ?? []).length;
      resolve({ code, pass, fail, out });
    });
  });
}

const suites = await collect();
if (suites.length === 0) {
  console.error(FILTER.length ? `No suite matches ${FILTER.join(', ')}` : 'No suites found.');
  process.exit(1);
}

// Inside the project on purpose: react and jsdom are left external, so the
// bundles have to sit somewhere their imports resolve from node_modules.
const outDir = path.join(ROOT, 'node_modules', '.cache', 'secret-hitler-tests');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
let totalPass = 0;
let totalFail = 0;
const broken = [];

try {
  for (const suite of suites) {
    process.stdout.write(`${suite.rel.padEnd(42)}`);
    let file;
    try {
      file = await compile(suite, outDir);
    } catch (error) {
      console.log('COMPILE ERROR');
      console.log(String(error).split('\n').slice(0, 8).map((l) => `    ${l}`).join('\n'));
      broken.push(suite.rel);
      continue;
    }

    const { code, pass, fail, out } = await run(file, ROOT);
    totalPass += pass;
    totalFail += fail;

    // A suite with no PASS lines asserts by throwing instead; the exit code is
    // the whole result there.
    const label = pass + fail > 0 ? `${pass} passed` : 'ok';
    if (code === 0 && fail === 0) {
      console.log(`${label}`);
    } else {
      console.log(`${fail} FAILED${code !== 0 ? ` (exit ${code})` : ''}`);
      broken.push(suite.rel);
      console.log(out.split('\n').filter((l) => /^FAIL|Error/.test(l)).slice(0, 6)
        .map((l) => `    ${l}`).join('\n'));
    }
  }
} finally {
  await rm(outDir, { recursive: true, force: true });
}

console.log('\n' + '-'.repeat(58));
console.log(`${suites.length} suites   ${totalPass} assertions passed   ${totalFail} failed`);
if (broken.length) {
  console.log(`failing: ${broken.join(', ')}`);
  process.exit(1);
}
console.log('all green');
