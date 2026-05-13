// Smoke test: load the production bundle in jsdom and assert React mounted.
//
// Catches module-evaluation errors (e.g. an undeclared variable in a top-level
// data structure) that `vite build` does not — Vite bundles successfully but
// the error only fires when the script actually runs in a browser.
//
// Run via `npm run smoke` (which builds first).

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
const bundleMatch = html.match(/src="([^"]+\.js)"/);
if (!bundleMatch) {
  console.error('SMOKE FAIL: no <script> in dist/index.html');
  process.exit(1);
}
const bundlePath = join(root, 'dist', bundleMatch[1].replace(/^\//, ''));
const bundle = readFileSync(bundlePath, 'utf8');

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', e => errors.push({ kind: 'jsdomError', msg: e.message, stack: e.stack }));
virtualConsole.on('error', (...args) => errors.push({ kind: 'console.error', args: args.map(String) }));

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole,
});

try {
  dom.window.eval(bundle);
} catch (e) {
  errors.push({ kind: 'throw', msg: e.message, stack: e.stack });
}

// React 18 createRoot schedules the initial mount via a microtask / scheduler,
// so we need to flush before checking the DOM.
await new Promise(r => setTimeout(r, 100));

const rootChildren = dom.window.document.getElementById('root')?.children?.length ?? 0;

if (errors.length > 0) {
  console.error('SMOKE FAIL — runtime errors:');
  for (const e of errors) console.error(JSON.stringify(e, null, 2));
  process.exit(1);
}

if (rootChildren === 0) {
  console.error('SMOKE FAIL — bundle ran without throwing but #root is empty (React did not mount)');
  process.exit(1);
}

console.log(`SMOKE PASS — bundle executed, #root has ${rootChildren} child(ren)`);
