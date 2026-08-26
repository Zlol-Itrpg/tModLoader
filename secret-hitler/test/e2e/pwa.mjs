import { chromium } from 'playwright';

const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const URL = process.env.PREVIEW_URL || 'http://localhost:4173/';

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },       // Pixel 8
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const failedRequests = [];
page.on('requestfailed', (r) => failedRequests.push(`${r.failure()?.errorText} ${r.url()}`));

/* ---- First load (online) ------------------------------------------------ */
await page.goto(URL, { waitUntil: 'networkidle' });
check('online: the app renders', (await page.textContent('body')).includes('Secret Hitler'));
check('online: setup screen is up', await page.locator('input[aria-label="New player name"]').isVisible());

const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
check('manifest is linked from the document', Boolean(manifestHref));
const manifest = await page.evaluate(async (href) => (await fetch(href)).json(), manifestHref);
check('manifest name', manifest.name === 'Secret Hitler XL');
check('manifest short_name', manifest.short_name === 'Secret Hitler');
check('manifest display is standalone', manifest.display === 'standalone');
check('manifest orientation is portrait', manifest.orientation === 'portrait');
check('manifest theme_color', manifest.theme_color === '#7f1d1d');
// Parchment, matching the app, so the splash does not flash dark first.
check('manifest background_color matches the app', manifest.background_color === '#e6dac0');
check('manifest ships a 192 icon', manifest.icons.some((i) => i.sizes === '192x192'));
check('manifest ships a 512 icon', manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'));
check('manifest ships a maskable icon', manifest.icons.some((i) => i.purpose === 'maskable'));

check('theme-color meta matches the manifest',
  await page.getAttribute('meta[name="theme-color"]', 'content') === '#7f1d1d');
check('apple-touch-icon declared',
  Boolean(await page.getAttribute('link[rel="apple-touch-icon"]', 'href')));
check('iOS standalone meta declared',
  await page.getAttribute('meta[name="apple-mobile-web-app-capable"]', 'content') === 'yes');
check('iOS home-screen title declared',
  await page.getAttribute('meta[name="apple-mobile-web-app-title"]', 'content') === 'Secret Hitler');
check('viewport opts into the safe-area insets',
  (await page.getAttribute('meta[name="viewport"]', 'content')).includes('viewport-fit=cover'));

for (const icon of ['pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png', 'apple-touch-icon.png', 'icon.svg']) {
  const status = await page.evaluate(async (u) => (await fetch(u)).status, `/${icon}`);
  check(`icon served: ${icon}`, status === 200);
}

/* ---- Service worker ----------------------------------------------------- */
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return { scope: reg.scope, active: Boolean(reg.active), state: reg.active?.state };
});
check('service worker registered and active', swState.active && swState.state === 'activated');
check('service worker scope covers the app', swState.scope.endsWith('/'));

const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = [];
  for (const n of names) out.push(...(await (await caches.open(n)).keys()).map((r) => r.url));
  return out;
});
check('precache populated', cached.length >= 15);
check('precache holds the app shell', cached.some((u) => u.endsWith('/') || u.includes('index.html')));
check('precache holds the JS bundle', cached.some((u) => /assets\/index-.*\.js/.test(u)));
check('precache holds the stylesheet', cached.some((u) => /assets\/index-.*\.css/.test(u)));
check('precache holds the fonts', cached.filter((u) => u.endsWith('.woff2')).length >= 4);
console.log(`  (${cached.length} cached entries)`);

/* ---- Fully offline ------------------------------------------------------ */
await context.setOffline(true);
failedRequests.length = 0;
await page.reload({ waitUntil: 'load' });

check('offline: the app still boots', (await page.textContent('body')).includes('Secret Hitler'));

// The browser fetches favicons and manifest icons out of band, outside any
// service worker client, so those can abort offline without the app noticing.
// What matters is that nothing the *page* loads failed, and that the icons are
// still served from the cache when something actually asks through the worker.
const appFailures = failedRequests.filter((f) => !/\.(png|svg|ico)$/.test(f));
check('offline: no request the page made failed', appFailures.length === 0);
if (appFailures.length) console.log(appFailures.map((f) => '    ' + f).join('\n'));
if (failedRequests.length !== appFailures.length) {
  console.log(`  (${failedRequests.length - appFailures.length} browser-initiated icon fetches aborted, as expected)`);
}
for (const asset of ['/icon.svg', '/apple-touch-icon.png', '/pwa-512x512.png', '/manifest.webmanifest']) {
  const status = await page.evaluate(async (u) => {
    try { return (await fetch(u)).status; } catch { return 0; }
  }, asset);
  check(`offline: the worker still serves ${asset}`, status === 200);
}

const fontsOffline = await page.evaluate(async () => {
  await document.fonts.ready;
  return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
});
check('offline: webfonts are available from the cache',
  fontsOffline.some((f) => f.includes('Playfair')) && fontsOffline.some((f) => f.includes('Oswald')));

// A cold navigation with no network at all must still resolve to the shell.
const deep = await context.newPage();
await deep.goto(`${URL}?cold=1`, { waitUntil: 'load' });
check('offline: a cold navigation resolves to the app shell',
  (await deep.textContent('body')).includes('Secret Hitler'));
await deep.close();

/* ---- Actually playable offline ------------------------------------------ */
await page.fill('input[aria-label="New player name"]', 'Braden');
await page.getByRole('button', { name: 'Add', exact: true }).click();
const roster = await page.locator('input[aria-label^="Name of player"]').count();
check('offline: the roster accepts a new player', roster >= 1);

await page.getByRole('button', { name: 'Deal roles' }).click();
check('offline: roles can be dealt',
  /pass the device to/i.test(await page.textContent('body')));
const reveal = page.locator('button[aria-label*="reveal my role"]').first();
await reveal.dispatchEvent('pointerdown');
await page.waitForTimeout(900);
check('offline: a role reveal works end to end', (await page.textContent('body')).includes('You are'));

const saved = await page.evaluate(() => localStorage.getItem('secret-hitler-save'));
check('offline: the game is being saved', Boolean(saved) && JSON.parse(saved).version === 1);

await page.screenshot({ path: '/tmp/pwa-offline.png' });
await browser.close();
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nPWA verified: installable, and fully playable offline');
