import { spawn } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const playwrightPackage = process.env.PLAYWRIGHT_PACKAGE ?? 'playwright';
const playwright = await import(playwrightPackage.endsWith('.js') ? playwrightPackage : join(playwrightPackage, 'index.js'));
const { chromium } = playwright.default ?? playwright;
const server = spawn(process.execPath, ['serve.ts'], { stdio: ['ignore', 'pipe', 'inherit'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
try {
  for (let i = 0; i < 50; i += 1) {
    try { const response = await fetch('http://localhost:8080/'); if (response.ok) break; } catch {}
    await delay(100);
    if (i === 49) throw new Error(`server did not start: ${serverOutput}`);
  }

  const browser = await chromium.launch({ headless: true });
  const state = {
    v: 1,
    earned: Object.fromEntries([2, 3, 4, 5, 8, 9, 15, 16, 19, 28, 31, 35, 53].map((id) => [String(id), true])),
    counters: { 28: 7, 15: 96, 17: 12, 31: 34, 35: 41, 32: 11 },
    settings: { spoiler: true }, notes: {}, revealed: {}
  };
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.addInitScript((value) => localStorage.setItem('leonida-field-guide-v1', JSON.stringify(value)), state);
  const shots = [
    ['1-cover.jpg', 'http://localhost:8080/#/trophy/28', 'checklist'],
    ['2-roadmap.jpg', 'http://localhost:8080/#/roadmap', 'roadmap'],
    ['3-missables.jpg', 'http://localhost:8080/#/missables', 'missables'],
    ['4-planner.jpg', 'http://localhost:8080/#/next', 'next']
  ];
  const manifest = [];
  for (const [file, url, view] of shots) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `screenshots/${file}`, type: 'jpeg', quality: 80 });
    const bytes = readFileSync(`screenshots/${file}`);
    const dimensions = jpegDimensions(bytes);
    const stat = statSync(`screenshots/${file}`);
    if (dimensions.width !== 1280 || dimensions.height !== 800 || stat.size > 250 * 1024) {
      throw new Error(`${file} failed validation: ${stat.size} bytes ${dimensions.width}x${dimensions.height}`);
    }
    console.log(`${file}: ${stat.size} bytes, ${dimensions.width}x${dimensions.height}`);
    manifest.push({ file, view, viewport: { width: 1280, height: 800 } });
  }
  await browser.close();
  writeFileSync('shots.json', `${JSON.stringify(manifest, null, 2)}\n`);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  console.log(`console errors: ${errors.length}`);
} finally {
  server.kill();
}

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('not a JPEG');
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG dimensions not found');
}
