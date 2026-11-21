// Draws the three image files in src/frontend/public from the favicon and
// the system's own fonts: favicon.ico (a 32px PNG, as on jch254.com),
// apple-touch-icon.png (180px) and og.png (1200 by 630).
//
//   PLAYWRIGHT_PATH=/path/to/node_modules/playwright node docs/design/tools/assets.mjs
//
// Playwright is not a dependency of this repo. Point PLAYWRIGHT_PATH at a
// copy installed somewhere else. Run it again when the headline, the favicon
// or a token changes.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.env.PLAYWRIGHT_PATH) {
  console.error('usage: PLAYWRIGHT_PATH=... node docs/design/tools/assets.mjs');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH);

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, '../../../src/frontend');
const publicDir = path.join(frontend, 'public');
const url = (file) => pathToFileURL(path.join(frontend, file)).href;

const favicon = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8');

// The Open Graph image, as jch254.com draws it: the light page colour, the
// avatar and the site switch where the header has them, the h1 scaled up to
// the card and one mono line at the foot.
const og = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Schibsted Grotesk'; font-weight: 400 900; src: url('${url('src/styles/fonts/schibsted-grotesk-latin.woff2')}') format('woff2'); }
@font-face { font-family: 'Spline Sans Mono'; font-weight: 300 700; src: url('${url('src/styles/fonts/spline-sans-mono-latin.woff2')}') format('woff2'); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; padding: 56px 72px 60px; display: flex; flex-direction: column; background: #fbfbf8; color: #141a17; font-family: 'Schibsted Grotesk'; -webkit-font-smoothing: antialiased; }
.head { display: flex; align-items: center; gap: 20px; font-size: 25px; letter-spacing: -0.01em; }
.head img { width: 48px; height: 48px; border-radius: 6px; }
.head .other { margin-left: 8px; color: #3d4741; font-weight: 450; }
.head .current { display: flex; align-items: center; gap: 9px; margin-left: 10px; font-weight: 650; }
.node { width: 9px; height: 9px; border-radius: 50%; background: #2bb67d; }
h1 { margin-top: 64px; font-size: 104px; font-weight: 600; line-height: 1.02; letter-spacing: -0.04em; }
h1 span { display: block; }
p { margin-top: auto; font-family: 'Spline Sans Mono'; font-size: 20px; color: #5a655e; }
</style></head><body>
<div class="head"><img src="${url('src/demo/avatar.webp')}" alt=""><span class="other">603.nz</span><span class="current"><span class="node"></span>Reference Architecture</span></div>
<h1><span>The baseline I copy</span><span>when I start</span><span>a product.</span></h1>
<p>NestJS &middot; DynamoDB &middot; React &middot; Docker &middot; Terraform &middot; AWS</p>
</body></html>`;

const browser = await chromium.launch();

// The pages load fonts and the avatar from disk, so they are written beside
// the output and opened as files. A page set with setContent has no origin
// and may not read file URLs.
async function shoot(html, width, height, file, transparent) {
  const source = path.join(publicDir, `.${file}.html`);
  fs.writeFileSync(source, html);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light' });
  await page.goto(pathToFileURL(source).href, { waitUntil: 'load' });
  // Ask for every declared face by name. fonts.ready alone can resolve
  // before a face that is only used further down the page has been fetched.
  const faces = await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((face) => face.load()));
    await document.fonts.ready;
    return [...document.fonts].map((face) => `${face.family} ${face.status}`);
  });
  if (faces.some((face) => !face.endsWith('loaded'))) throw new Error(`a font did not load: ${faces.join(', ')}`);
  await page.screenshot({ path: path.join(publicDir, file), omitBackground: transparent });
  await page.close();
  fs.rmSync(source);
  console.log(file, fs.statSync(path.join(publicDir, file)).size, 'bytes');
}

const icon = (size) =>
  `<!doctype html><html><body style="margin:0">${favicon.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `)}</body></html>`;

// Playwright names the format from the extension, so the 32px PNG is written
// as a .png and then renamed. Browsers read a PNG behind the .ico name.
await shoot(icon(32), 32, 32, 'favicon-32.png', true);
fs.renameSync(path.join(publicDir, 'favicon-32.png'), path.join(publicDir, 'favicon.ico'));
await shoot(icon(180), 180, 180, 'apple-touch-icon.png', true);
await shoot(og, 1200, 630, 'og.png', false);

await browser.close();
