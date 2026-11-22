// Renders the app icon (SVG) to the PNG sizes the manifest and iOS need.
// Uses the Playwright/Chromium already on the machine: node scripts/make-icons.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const svg = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
// Full-bleed square for iOS and maskable icons (the OS rounds the corners itself).
const square = svg.replace('rx="116"', 'rx="0"');
const maskable = square.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-48 -48 608 608"><rect x="-48" y="-48" width="608" height="608" fill="#0B0F14"/>');

const targets = [
  { file: 'icons/icon-192.png', size: 192, svg: square },
  { file: 'icons/icon-512.png', size: 512, svg: square },
  { file: 'icons/maskable-512.png', size: 512, svg: maskable },
  { file: 'icons/apple-touch-icon.png', size: 180, svg: square },
  { file: 'icons/favicon-32.png', size: 32, svg },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${t.svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(root, 'public', t.file), omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log('wrote', t.file);
}
await browser.close();
