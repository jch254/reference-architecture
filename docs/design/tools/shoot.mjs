// Screenshots of every state of the demo, for checking the design at fixed
// widths in both themes.
//
//   PLAYWRIGHT_PATH=/path/to/node_modules/playwright \
//     node docs/design/tools/shoot.mjs <outDir> [options]
//
//   --only=<text>      Only states whose name contains this text.
//   --widths=390,1280  Default 390,768,1280,1920.
//   --themes=light     Default light,dark.
//   --scale=2          Device scale factor. Default 1.
//   --measure          Print layout facts for each capture: sideways
//                      overflow and, at touch widths, targets under 44px.
//   --slice=1100       Also save the page in pieces this many pixels tall,
//                      for reading a long page at full size.
//
// It needs a build in src/frontend/dist and nothing running. The script
// answers every request itself: pages and assets come from dist with the
// content security policy Helmet sends, and /api is a small stand-in for the
// backend that keeps records in memory. Each state names the host it is
// loaded from, so the page sees one of the three deployments, or none.
//
// Playwright is not a dependency of this repo. Point PLAYWRIGHT_PATH at a
// copy installed somewhere else.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const outDir = args.find((arg) => !arg.startsWith('--'));
const option = (name, fallback) => {
  const found = args.find((arg) => arg.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
if (!outDir || !process.env.PLAYWRIGHT_PATH) {
  console.error('usage: PLAYWRIGHT_PATH=... node docs/design/tools/shoot.mjs <outDir> [--only=] [--widths=] [--themes=] [--scale=] [--measure]');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH);

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../../src/frontend/dist');
const only = option('only', '');
const widths = option('widths', '390,768,1280,1920').split(',').map(Number);
const themes = option('themes', 'light,dark').split(',');
const scale = Number(option('scale', '1'));
const measure = args.includes('--measure');
const slice = Number(option('slice', '0'));

fs.mkdirSync(outDir, { recursive: true });

// ------------------------------------------------------------------- data

const FARGATE = 'https://reference-architecture.603.nz';
const AUTH0 = 'https://reference-architecture-auth0.603.nz';
const LAMBDA = 'https://reference-architecture-lambda.603.nz';
const LOCAL = 'http://localhost:3000';

const CONFIG = {
  magic: { authProvider: 'internal_magic_link', compute: 'ecs', auth0: null },
  magicLambda: { authProvider: 'internal_magic_link', compute: 'lambda', auth0: null },
  magicLocal: { authProvider: 'internal_magic_link', compute: 'local', auth0: null },
  none: { authProvider: 'none', compute: 'local', auth0: null },
  oidc: {
    authProvider: 'oidc',
    compute: 'lambda',
    auth0: { domain: 'refarch.au.auth0.com', clientId: 'spaClientId123', audience: `${AUTH0}/api` },
  },
  oidcMissing: { authProvider: 'oidc', compute: 'lambda', auth0: null },
};

const USER_ID = '6f1c2a9e-4b7d-4e2a-9c31-0d5e8a7b2f14';
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const magicUser = () => ({
  userId: USER_ID,
  tenantId: 'reference-architecture',
  provider: 'internal_magic_link',
  providerSubject: 'ada@example.com',
  email: 'ada@example.com',
  createdAt: minutesAgo(10),
  updatedAt: minutesAgo(10),
  lastSeenAt: minutesAgo(0),
});

const oidcUser = () => ({
  userId: USER_ID,
  tenantId: 'refarch-auth0-demo',
  provider: 'oidc',
  providerSubject: 'auth0|6645f0c2a1b7e9d3c8f41a70',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  createdAt: minutesAgo(10),
  updatedAt: minutesAgo(10),
  lastSeenAt: minutesAgo(0),
});

const threeRecords = () => [
  { id: '3f9a1c2e', userId: USER_ID, name: 'Renamed after a tpyo', createdAt: minutesAgo(2), updatedAt: minutesAgo(2) },
  { id: 'b07d44f1', userId: USER_ID, name: 'Created from the Fargate demo', createdAt: minutesAgo(6), updatedAt: minutesAgo(6) },
  { id: '91c6e0aa', userId: USER_ID, name: 'Delete me, then undo', createdAt: minutesAgo(9), updatedAt: minutesAgo(9) },
];

// How long the stand-in takes to answer, so the log shows plausible times.
const LATENCY = {
  '/api/config': 40,
  '/api/health': 12,
  '/api/auth/session': 20,
  '/api/auth/check': 18,
  '/api/me': 35,
  '/api/example': 29,
};

const NEVER = Symbol('never');

// ----------------------------------------------------------------- states

// A state is one page in one condition. `api` may answer a request itself:
// return NEVER to leave it hanging (a loading state), a [status, body] pair
// to answer it, or nothing to fall through to the stand-in. `steps` then
// drives the page to the state.
const signedInSteps = async (page) => {
  await page.getByRole('button', { name: 'Rename Renamed after a tpyo' }).click();
  await page.getByLabel('New name for Renamed after a tpyo').fill('Renamed after a typo');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /200 PATCH/ }).waitFor();
};

const STATES = [
  { name: '01-config-loading', api: (m, p) => (p === '/api/config' ? NEVER : undefined) },
  { name: '02-config-failed', api: (m, p) => (p === '/api/config' ? [502, { error: { code: 'INTERNAL_ERROR', message: 'Bad Gateway' } }] : undefined) },
  { name: '03-oidc-misconfigured', origin: AUTH0, config: CONFIG.oidcMissing },
  { name: '04-session-loading', api: (m, p) => (p === '/api/auth/session' ? NEVER : undefined) },
  { name: '05-signed-out' },
  { name: '05-signed-out-lambda', origin: LAMBDA, config: CONFIG.magicLambda },
  { name: '05-signed-out-unknown-host', origin: LOCAL, config: CONFIG.magicLocal },
  {
    name: '06-sending-link',
    api: (m, p) => (p === '/api/auth/request-link' ? NEVER : undefined),
    steps: async (page) => {
      await page.getByLabel('Sign in with a magic link').fill('ada@example.com');
      await page.getByRole('button', { name: 'Send link' }).click();
    },
  },
  {
    name: '07-request-failed',
    api: (m, p) => (p === '/api/auth/request-link' ? [429, { error: { code: 'RATE_LIMITED', message: 'Too Many Requests', requestId: 'a81f03de' } }] : undefined),
    steps: async (page) => {
      await page.getByLabel('Sign in with a magic link').fill('ada@example.com');
      await page.getByRole('button', { name: 'Send link' }).click();
      await page.getByRole('alert').waitFor();
    },
  },
  {
    name: '08-link-sent',
    steps: async (page) => {
      await page.getByLabel('Sign in with a magic link').fill('ada@example.com');
      await page.getByRole('button', { name: 'Send link' }).click();
      await page.getByRole('heading', { name: 'Check your email.' }).waitFor();
    },
  },
  { name: '09-link-error-used-or-expired', path: '/?auth=error&reason=consumed' },
  { name: '10-link-error-no-token', path: '/?auth=error' },
  { name: '11-signed-in-user-loading', session: true, records: threeRecords, api: (m, p) => (p === '/api/me' ? NEVER : undefined) },
  { name: '12-signed-in-no-records', session: true },
  { name: '13-signed-in', session: true, records: threeRecords, steps: signedInSteps },
  {
    name: '14-creating',
    session: true,
    records: threeRecords,
    api: (m, p) => (m === 'POST' && p === '/api/example' ? NEVER : undefined),
    steps: async (page) => {
      await page.getByLabel('Record name').fill('Still on its way to the API');
      await page.getByRole('button', { name: 'Add' }).click();
    },
  },
  {
    name: '15-renaming',
    session: true,
    records: threeRecords,
    steps: async (page) => {
      await page.getByRole('button', { name: 'Rename Created from the Fargate demo' }).click();
    },
  },
  {
    name: '16-api-error',
    session: true,
    records: threeRecords,
    api: (m, p) => (m === 'POST' && p === '/api/example' ? [500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: '9c2e41b0' } }] : undefined),
    steps: async (page) => {
      await page.getByLabel('Record name').fill('This one is refused');
      await page.getByRole('button', { name: 'Add' }).click();
      await page.getByRole('alert').waitFor();
    },
  },
  { name: '18-oidc-auth0-loading', origin: AUTH0, config: CONFIG.oidc, auth0: 'loading' },
  { name: '19-oidc-signed-out', origin: AUTH0, config: CONFIG.oidc },
  { name: '20-oidc-sign-in-error', origin: AUTH0, config: CONFIG.oidc, path: '/?error=access_denied&error_description=User%20did%20not%20authorize%20the%20request&state=abc123' },
  { name: '22-oidc-signed-in-loading', origin: AUTH0, config: CONFIG.oidc, auth0: 'in', user: oidcUser, records: threeRecords, api: (m, p) => (p === '/api/me' ? NEVER : undefined) },
  {
    name: '23-oidc-bootstrap-error',
    origin: AUTH0,
    config: CONFIG.oidc,
    auth0: 'in',
    user: oidcUser,
    api: (m, p) => (p === '/api/me' ? [500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: '4be07a19' } }] : undefined),
  },
  { name: '24-oidc-signed-in', origin: AUTH0, config: CONFIG.oidc, auth0: 'in', user: oidcUser, records: threeRecords, steps: signedInSteps },
  {
    name: '25-oidc-session-invalid',
    origin: AUTH0,
    config: CONFIG.oidc,
    auth0: 'in',
    user: oidcUser,
    api: (m, p) => (p === '/api/me' || p === '/api/auth/check' ? [401, { error: { code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: '71d3c5aa' } }] : undefined),
  },
  { name: '26-list-loading', session: true, records: threeRecords, api: (m, p) => (m === 'GET' && p === '/api/example' ? NEVER : undefined) },
  {
    name: '27-delete-held-with-undo',
    session: true,
    records: threeRecords,
    keepPointer: true,
    steps: async (page) => {
      await page.getByRole('button', { name: 'Delete Delete me, then undo' }).click();
      await page.getByRole('button', { name: 'Undo' }).hover();
    },
  },
  {
    name: '28-log-empty',
    session: true,
    records: threeRecords,
    steps: async (page) => {
      await page.getByRole('button', { name: 'Clear' }).click();
    },
  },
  { name: '29-auth-provider-none', origin: LOCAL, config: CONFIG.none },
  {
    name: '30-no-record-selected',
    session: true,
    records: threeRecords,
    steps: async (page) => {
      await page.getByRole('button', { name: /^Renamed after a tpyo/ }).click();
    },
  },
  {
    name: '31-list-did-not-load',
    session: true,
    api: (m, p) => (m === 'GET' && p === '/api/example' ? [500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: '0e5d2f77' } }] : undefined),
  },
  {
    name: '32-log-entry-failed',
    steps: async (page) => {
      await page.getByRole('button', { name: /401 GET \/api\/auth\/session/ }).click();
    },
  },
];

// ------------------------------------------------------------- stand-in API

function standIn(state) {
  const user = state.user ? state.user() : magicUser();
  const principal = {
    provider: user.provider,
    subject: user.providerSubject,
    ...(user.email && { email: user.email }),
    ...(user.name && { name: user.name }),
  };
  let records = state.records ? state.records() : [];
  let created = 0;
  const signedIn = Boolean(state.session || state.auth0 === 'in');
  const unauthorized = [401, { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }];

  return (method, pathname, body) => {
    const custom = state.api?.(method, pathname);
    if (custom) return custom;

    const id = pathname.startsWith('/api/example/') ? pathname.slice('/api/example/'.length) : null;
    const now = new Date().toISOString();

    if (pathname === '/api/config') return [200, { data: state.config ?? CONFIG.magic }];
    if (pathname === '/api/health') return [200, { data: { status: 'ok' } }];
    if (pathname === '/api/auth/request-link') return [201, { data: { message: 'If that email is valid, a link has been sent.' } }];
    if (pathname === '/api/auth/session') {
      return state.session ? [200, { data: { email: user.email, tenantSlug: user.tenantId } }] : unauthorized;
    }
    if (pathname === '/api/auth/logout') return [201, { message: 'Logged out' }];
    if (!signedIn) return unauthorized;
    if (pathname === '/api/auth/check') return [200, { data: { authenticated: true, principal } }];
    if (pathname === '/api/me') return [200, { data: { user } }];
    if (pathname === '/api/example' && method === 'GET') return [200, { data: records }];
    if (pathname === '/api/example' && method === 'POST') {
      created += 1;
      const record = { id: `c0ffee0${created}`, userId: user.userId, name: body.name, createdAt: now, updatedAt: now };
      records = [record, ...records];
      return [201, { data: record }];
    }
    if (id && method === 'PATCH') {
      const record = records.find((item) => item.id === id);
      if (!record) return [404, { error: { code: 'NOT_FOUND', message: 'Example not found' } }];
      const updated = { ...record, name: body.name, updatedAt: now };
      records = records.map((item) => (item.id === id ? updated : item));
      return [200, { data: updated }];
    }
    if (id && method === 'DELETE') {
      records = records.filter((item) => item.id !== id);
      return [200, { data: { id } }];
    }
    return [404, { error: { code: 'NOT_FOUND', message: `Cannot ${method} ${pathname}` } }];
  };
}

// ------------------------------------------------------------------ server

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

// What Helmet sends from app.factory.ts, less upgrade-insecure-requests.
// Serving it here means a script, style or font the policy would block
// shows up as a problem in this run and not after a deploy.
const csp = (auth0Origin) =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "script-src-attr 'none'",
    "style-src 'self' https: 'unsafe-inline'",
    `connect-src 'self' https://cloudflareinsights.com${auth0Origin ? ` ${auth0Origin}` : ''}`,
    `frame-src 'self'${auth0Origin ? ` ${auth0Origin}` : ''}`,
  ].join('; ');

const requestId = () => Math.random().toString(16).slice(2, 10).padEnd(8, '0');

async function serve(route, state, origin, answer) {
  const request = route.request();
  const url = new URL(request.url());

  if (url.origin !== origin) {
    // Auth0 and anything else off the page's origin. A loading state leaves
    // Auth0 hanging. Everything else is refused.
    if (state.auth0 === 'loading') return;
    return route.abort();
  }

  if (url.pathname.startsWith('/api/')) {
    const method = request.method();
    const body = request.postDataJSON?.() ?? undefined;
    const result = answer(method, url.pathname, body);
    if (result === NEVER) return;
    const [status, payload] = result;
    await new Promise((resolve) => setTimeout(resolve, LATENCY[url.pathname] ?? 31));
    return route.fulfill({
      status,
      contentType: 'application/json; charset=utf-8',
      headers: { 'x-request-id': payload?.error?.requestId ?? requestId() },
      body: JSON.stringify(payload),
    });
  }

  let file = path.join(dist, url.pathname);
  if (!file.startsWith(dist) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(dist, 'index.html');
  }
  const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
  const auth0Origin = state.config?.auth0 ? `https://${state.config.auth0.domain}` : null;
  return route.fulfill({
    status: 200,
    headers: {
      'content-type': type,
      ...(type === TYPES['.html'] && { 'content-security-policy': csp(auth0Origin) }),
    },
    body: fs.readFileSync(file),
  });
}

// Signed in with Auth0 without a round trip to Auth0: the SDK's own cache
// entries, as it writes them to localStorage, and the cookie that tells it
// to look. The token is a placeholder. The stand-in API does not read it.
function seedAuth0(state, origin) {
  const { clientId, audience } = state.config.auth0;
  const user = state.user();
  const claims = { sub: user.providerSubject, email: user.email, name: user.name, exp: Math.floor(Date.now() / 1000) + 86400 };
  const idToken = 'placeholder.id.token';
  const entries = {
    [`@@auth0spajs@@::${clientId}::${audience}::openid profile email`]: {
      body: {
        access_token: 'placeholder-access-token',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 86400,
        audience,
        scope: 'openid profile email',
        client_id: clientId,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    },
    [`@@auth0spajs@@::${clientId}::@@user@@`]: {
      id_token: idToken,
      decodedToken: { claims: { __raw: idToken, ...claims }, user: claims },
    },
  };
  return { entries, cookie: { name: `auth0.${clientId}.is.authenticated`, value: 'true', url: origin } };
}

// ------------------------------------------------------------------- shoot

const browser = await chromium.launch();
const chosen = STATES.filter((state) => state.name.includes(only));
let count = 0;

for (const state of chosen) {
  const origin = state.origin ?? FARGATE;
  for (const width of widths) {
    for (const theme of themes) {
      const touch = width <= 768;
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: scale,
        colorScheme: theme,
        isMobile: touch,
        hasTouch: touch,
      });
      const page = await context.newPage();
      const name = `${state.name}-${width}-${theme}`;
      const problems = [];
      page.on('pageerror', (error) => problems.push(error.message));
      page.on('console', (message) => {
        const text = message.text();
        // The stand-in answers 401, 429 and 5xx on purpose, and Auth0 is refused.
        if (message.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_ABORTED/.test(text)) {
          problems.push(text.slice(0, 240));
        }
      });

      const answer = standIn(state);
      await context.route('**/*', (route) => serve(route, state, origin, answer));

      if (state.auth0 === 'in') {
        const { entries, cookie } = seedAuth0(state, origin);
        await context.addCookies([cookie]);
        await context.addInitScript((seed) => {
          for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(value));
        }, entries);
      }
      if (state.auth0 === 'loading') {
        await context.addCookies([{ name: `auth0.${state.config.auth0.clientId}.is.authenticated`, value: 'true', url: origin }]);
      }

      await page.goto(origin + (state.path ?? '/'), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // Let the requests the page makes on load be answered.
      await page.waitForTimeout(450);

      try {
        await state.steps?.(page);
      } catch (error) {
        problems.push(`steps: ${error.message.split('\n')[0]}`);
      }
      // Park the pointer where it hovers nothing, unless the state is a hover.
      if (!state.keepPointer) await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      await page.evaluate(() => document.fonts.ready);

      await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
      count += 1;

      if (slice) {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let top = 0, part = 1; top < height; top += slice, part += 1) {
          await page.screenshot({
            path: path.join(outDir, `${name}.part${part}.png`),
            fullPage: true,
            clip: { x: 0, y: top, width, height: Math.min(slice, height - top) },
          });
        }
      }

      if (measure) {
        const facts = await page.evaluate((isTouch) => {
          const root = document.documentElement;
          const overflow = root.scrollWidth - root.clientWidth;
          const small = [];
          if (isTouch) {
            for (const element of document.querySelectorAll('a, button, input')) {
              const box = element.getBoundingClientRect();
              if (box.width === 0 || box.height === 0) continue;
              // A link inside a sentence is exempt from the target size rule.
              if (element.closest('.lede, .body, .text, .small, .site-footer-legal')) continue;
              // An invisible pad may widen the target without moving anything.
              const pad = getComputedStyle(element, '::after');
              const padded = pad.position === 'absolute' && pad.content !== 'none';
              if (!padded && (box.height < 43.5 || (element.tagName === 'BUTTON' && box.width < 43.5))) {
                small.push(`${Math.round(box.width)}x${Math.round(box.height)} "${(element.getAttribute('aria-label') || element.textContent || element.id).trim().slice(0, 32)}"`);
              }
            }
          }
          const fonts = [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replace(/"/g, ''));
          return { height: root.scrollHeight, overflow, small, fonts: [...new Set(fonts)] };
        }, touch);
        console.log(name, JSON.stringify(facts));
      }
      if (problems.length) console.log(name, 'PROBLEMS', [...new Set(problems)].slice(0, 6));
      await context.close();
    }
  }
}

await browser.close();
console.log('shot', count);
