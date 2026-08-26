import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const page = await context.newPage();

const measure = async (label) => {
  const rows = await page.$$eval('button', (els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { name: (el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 34), w: Math.round(r.width), h: Math.round(r.height) };
  }).filter((b) => b.w > 0));
  const small = rows.filter((b) => b.w < 48 || b.h < 48);
  console.log(`\n${label}: ${rows.length} buttons, ${small.length} under 48x48`);
  small.forEach((b) => console.log(`   ${String(b.w).padStart(3)}x${String(b.h).padStart(3)}  ${b.name}`));
};

await page.goto(process.env.PREVIEW_URL || 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await measure('SETUP');

await page.getByRole('button', { name: 'Deal roles' }).click();
await measure('ROLE_REVEAL (covered)');
await page.locator('button[aria-label*="reveal my role"]').first().dispatchEvent('pointerdown');
await page.waitForTimeout(800);
await measure('ROLE_REVEAL (revealed)');

// Clear the reveals, reach nomination, then the ballot.
for (let i = 0; i < 7; i++) {
  const done = page.locator('button').filter({ hasText: /pass on|begin the first nomination/i }).first();
  await done.click();
  if (i < 6) { await page.locator('button[aria-label*="reveal my role"]').first().dispatchEvent('pointerdown'); await page.waitForTimeout(700); }
}
await measure('NOMINATION');
await page.locator('li button[aria-pressed]:not([disabled])').first().click();
await page.getByRole('button', { name: 'Confirm nomination' }).click();
await page.locator('button[aria-label*="show my ballot"]').first().dispatchEvent('pointerdown');
await page.waitForTimeout(700);
await measure('VOTING (Ja/Nein)');

await browser.close();
