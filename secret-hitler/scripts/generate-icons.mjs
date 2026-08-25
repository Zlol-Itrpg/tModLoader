import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Render the PWA icon set from public/icon.svg.
 *
 * Run with `npm run icons` after editing the SVG. The PNGs are committed so a
 * plain `npm install && npm run build` needs no image toolchain.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const BACKGROUND = '#7f1d1d';

const source = await readFile(path.join(PUBLIC, 'icon.svg'));

/** Square PNG, opaque — iOS and Android both composite badly over alpha. */
async function render(size, { inset = 0, name }) {
  const art = Math.round(size * (1 - inset));
  const pad = Math.round((size - art) / 2);

  const buffer = await sharp(source, { density: 512 })
    .resize(art, art)
    .png()
    .toBuffer();

  const out = await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: buffer, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(path.join(PUBLIC, name), out);
  return `${name} (${size}x${size}, ${(out.length / 1024).toFixed(1)}kB)`;
}

await mkdir(PUBLIC, { recursive: true });

const written = [
  await render(192, { name: 'pwa-192x192.png' }),
  await render(512, { name: 'pwa-512x512.png' }),
  // Maskable icons get cropped to a circle or squircle depending on the
  // launcher, so the artwork has to sit inside a 40% safe zone.
  await render(512, { name: 'pwa-maskable-512x512.png', inset: 0.3 }),
  // iOS applies its own rounding and never uses the maskable variant.
  await render(180, { name: 'apple-touch-icon.png' }),
];

console.log(written.map((line) => `  ${line}`).join('\n'));
