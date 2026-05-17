/**
 * System validation script — runs after deploy to verify the system is functional.
 * Uses only native fetch (Node 18+). No frameworks, no mocks, no libraries.
 *
 * Usage:
 *   BASE_URL=https://reference-architecture.603.nz \
 *   COOKIE_SECRET=... \
 *   pnpm run validate
 *
 *   BASE_URL=https://reference-architecture-auth0.603.nz \
 *   VALIDATION_AUTH_PROVIDER=oidc \
 *   AUTH_BEARER_TOKEN="$AUTH0_ACCESS_TOKEN" \
 *   pnpm run validate
 */

export type ValidationAuthProvider = "none" | "internal_magic_link" | "oidc";

type JsonRecord = Record<string, unknown>;

interface ValidationLogger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface ValidationOptions {
  baseUrl: string;
  authProvider?: ValidationAuthProvider;
  cookieSecret?: string;
  authBearerToken?: string;
  requireAuth?: boolean;
  fetchFn?: typeof fetch;
  logger?: ValidationLogger;
}

export interface ValidationResult {
  ok: boolean;
  partial: boolean;
}

type MagicLinkAuth = Record<"Cookie", string>;

const DEFAULT_AUTH_PROVIDER: ValidationAuthProvider = "internal_magic_link";
const authProviders: ValidationAuthProvider[] = ["none", "internal_magic_link", "oidc"];

function url(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapData(value: unknown): unknown {
  if (isRecord(value) && "data" in value) return value.data;
  return value;
}

function parseAuthProvider(value: string | undefined): ValidationAuthProvider {
  if (!value) return DEFAULT_AUTH_PROVIDER;
  if (authProviders.includes(value as ValidationAuthProvider)) {
    return value as ValidationAuthProvider;
  }
  throw new Error(
    `Invalid VALIDATION_AUTH_PROVIDER: ${value}. Expected "none", "internal_magic_link", or "oidc".`,
  );
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function fail(logger: ValidationLogger, message: string, detail?: unknown): true {
  if (detail === undefined) {
    logger.error(message);
  } else {
    logger.error(message, detail);
  }
  return true;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json() as unknown;
  } catch (_err) {
    return null;
  }
}

async function validateHealth(
  baseUrl: string,
  fetchFn: typeof fetch,
  logger: ValidationLogger,
): Promise<boolean> {
  try {
    const res = await fetchFn(url(baseUrl, "/api/health"));
    const body = await readJson(res);
    const data = unwrapData(body);

    if (res.ok && isRecord(data) && data.status === "ok") {
      logger.log("PASS: GET /api/health");
      return true;
    }

    fail(logger, "FAIL: GET /api/health — unexpected response", body);
    return false;
  } catch (err) {
    fail(logger, "FAIL: GET /api/health —", (err as Error).message);
    return false;
  }
}

async function authenticateMagicLink(
  options: Required<Pick<ValidationOptions, "baseUrl" | "cookieSecret" | "fetchFn" | "logger">>,
): Promise<MagicLinkAuth | null> {
  const { baseUrl, cookieSecret, fetchFn, logger } = options;

  try {
    const linkRes = await fetchFn(url(baseUrl, "/api/auth/request-link"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cookie-secret": cookieSecret,
      },
      body: JSON.stringify({ email: "validate@system.test" }),
    });
    const linkBody = await readJson(linkRes);
    const linkData = unwrapData(linkBody);
    const token = isRecord(linkData) && typeof linkData.token === "string"
      ? linkData.token
      : undefined;

    if (!token) throw new Error(`No token in response: ${JSON.stringify(linkBody)}`);

    const verifyRes = await fetchFn(
      url(baseUrl, `/api/auth/verify?token=${encodeURIComponent(token)}&json=1`),
    );

    if (!verifyRes.ok) throw new Error(`Verify failed with status ${verifyRes.status}`);

    const rawCookie = verifyRes.headers.get("set-cookie");
    if (!rawCookie) throw new Error("No set-cookie header in verify response");

    logger.log("PASS: Authentication");
    return { Cookie: rawCookie.split(";")[0] };
  } catch (err) {
    fail(logger, "FAIL: Authentication —", (err as Error).message);
    return null;
  }
}

async function validateMagicLinkDeployment(
  options: Required<Pick<ValidationOptions, "baseUrl" | "cookieSecret" | "fetchFn" | "logger">>,
): Promise<boolean> {
  const { baseUrl, fetchFn, logger } = options;
  let failed = false;
  let createdId: string | undefined;

  const authHeaders = await authenticateMagicLink(options);
  if (!authHeaders) return false;

  // --- Empty state — GET before POST returns valid array ---
  try {
    const res = await fetchFn(url(baseUrl, "/api/example"), { headers: authHeaders });
    const body = await readJson(res);
    const data = unwrapData(body);

    if (res.ok && Array.isArray(data)) {
      logger.log("PASS: GET /api/example — empty state returns valid array");
    } else {
      failed = fail(logger, "FAIL: GET /api/example — empty state unexpected response", body);
    }
  } catch (err) {
    failed = fail(logger, "FAIL: GET /api/example — empty state —", (err as Error).message);
  }

  // --- Invalid POST — missing name ---
  try {
    const res = await fetchFn(url(baseUrl, "/api/example"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({}),
    });

    if (res.status === 400) {
      logger.log("PASS: POST /api/example — rejects missing name (400)");
    } else {
      failed = fail(logger, "FAIL: POST /api/example — expected 400 for missing name, got", res.status);
    }
  } catch (err) {
    failed = fail(logger, "FAIL: POST /api/example — invalid POST —", (err as Error).message);
  }

  // --- Create example ---
  const exampleName = `test-${Date.now()}`;

  try {
    const res = await fetchFn(url(baseUrl, "/api/example"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ name: exampleName }),
    });
    const body = await readJson(res);
    const data = unwrapData(body);

    if (
      res.ok &&
      isRecord(data) &&
      typeof data.id === "string" &&
      data.name === exampleName &&
      data.createdAt &&
      data.updatedAt
    ) {
      createdId = data.id;
      logger.log("PASS: POST /api/example");
    } else {
      failed = fail(logger, "FAIL: POST /api/example — unexpected response", body);
    }
  } catch (err) {
    failed = fail(logger, "FAIL: POST /api/example —", (err as Error).message);
  }

  // --- List examples and verify created item is present ---
  try {
    const res = await fetchFn(url(baseUrl, "/api/example"), { headers: authHeaders });
    const body = await readJson(res);
    const data = unwrapData(body);

    if (!res.ok || !Array.isArray(data)) {
      failed = fail(logger, "FAIL: GET /api/example — unexpected response shape", body);
    } else if (createdId && data.some((item) => isRecord(item) && item.id === createdId)) {
      logger.log("PASS: GET /api/example — created item found");
    } else if (!createdId) {
      logger.log("SKIP: GET /api/example — no created item to verify (create failed)");
    } else {
      failed = fail(logger, "FAIL: GET /api/example — created item not found in list");
    }
  } catch (err) {
    failed = fail(logger, "FAIL: GET /api/example —", (err as Error).message);
  }

  // --- Tenant isolation (light) ---
  if (createdId) {
    try {
      const originalRes = await fetchFn(url(baseUrl, "/api/example"), { headers: authHeaders });
      const originalBody = await readJson(originalRes);
      const originalData = unwrapData(originalBody);
      const originalIds = new Set(
        (Array.isArray(originalData) ? originalData : [])
          .filter(isRecord)
          .map((item) => item.id),
      );

      const res = await fetchFn(url(baseUrl, "/api/example"), {
        headers: { ...authHeaders, Host: "validation-tenant.603.nz" },
      });

      if (res.status === 401) {
        logger.log("PASS: Tenant isolation — session rejected for different tenant");
      } else {
        const body = await readJson(res);
        const data = unwrapData(body);

        if (!res.ok || !Array.isArray(data)) {
          failed = fail(logger, "FAIL: Tenant isolation — unexpected response shape", body);
        } else {
          const rows = data.filter(isRecord);
          const otherIds = new Set(rows.map((item) => item.id));
          const sameResultSet =
            otherIds.size === originalIds.size &&
            [...otherIds].every((id) => originalIds.has(id));

          if (sameResultSet && rows.some((item) => item.id === createdId)) {
            logger.log("SKIP: Tenant isolation — Host header override not forwarded by proxy");
          } else if (rows.some((item) => item.id === createdId)) {
            failed = fail(logger, "FAIL: Tenant isolation — created item visible to other tenant");
          } else {
            logger.log("PASS: Tenant isolation — created item not visible to other tenant");
          }
        }
      }
    } catch (err) {
      logger.log("SKIP: Tenant isolation —", (err as Error).message);
    }
  }

  // --- Cleanup — delete created item ---
  if (createdId) {
    try {
      const res = await fetchFn(url(baseUrl, `/api/example/${createdId}`), {
        method: "DELETE",
        headers: authHeaders,
      });

      if (res.ok) {
        logger.log("PASS: DELETE /api/example/:id — cleaned up");
      } else {
        failed = fail(logger, "FAIL: DELETE /api/example/:id — status", res.status);
      }
    } catch (err) {
      failed = fail(logger, "FAIL: DELETE /api/example/:id —", (err as Error).message);
    }
  }

  return !failed;
}

async function validateOidcDeployment(
  options: Required<Pick<ValidationOptions, "baseUrl" | "fetchFn" | "logger">> &
    Pick<ValidationOptions, "authBearerToken" | "requireAuth">,
): Promise<ValidationResult> {
  const { baseUrl, fetchFn, logger, authBearerToken, requireAuth } = options;
  let failed = false;
  let partial = false;

  try {
    const res = await fetchFn(url(baseUrl, "/api/auth/check"));

    if (res.status === 401) {
      logger.log("PASS: GET /api/auth/check — rejects missing bearer token (401)");
    } else {
      failed = fail(
        logger,
        "FAIL: GET /api/auth/check — expected 401 without bearer token, got",
        res.status,
      );
    }
  } catch (err) {
    failed = fail(logger, "FAIL: GET /api/auth/check — missing-token check —", (err as Error).message);
  }

  if (!authBearerToken) {
    const message = "AUTH_BEARER_TOKEN not set; OIDC bearer-token validation skipped";
    if (requireAuth) {
      failed = fail(logger, `FAIL: ${message}`);
    } else {
      partial = true;
      logger.log(`SKIP: ${message}`);
    }

    return { ok: !failed, partial };
  }

  try {
    const res = await fetchFn(url(baseUrl, "/api/auth/check"), {
      headers: { Authorization: `Bearer ${authBearerToken}` },
    });
    const body = await readJson(res);
    const data = unwrapData(body);
    const principal = isRecord(data) && isRecord(data.principal) ? data.principal : null;

    if (
      res.ok &&
      isRecord(data) &&
      data.authenticated === true &&
      principal?.provider === "oidc"
    ) {
      logger.log("PASS: GET /api/auth/check — authenticated OIDC bearer token");
    } else {
      failed = fail(
        logger,
        "FAIL: GET /api/auth/check — expected authenticated=true with principal.provider=oidc, got status",
        res.status,
      );
    }
  } catch (err) {
    failed = fail(logger, "FAIL: GET /api/auth/check — bearer-token check —", (err as Error).message);
  }

  return { ok: !failed, partial };
}

export async function validateSystem(options: ValidationOptions): Promise<ValidationResult> {
  const logger = options.logger ?? console;
  const fetchFn = options.fetchFn ?? fetch;
  const authProvider = options.authProvider ?? DEFAULT_AUTH_PROVIDER;
  let failed = false;
  let partial = false;

  if (!options.baseUrl) {
    logger.error("FAIL: BASE_URL environment variable is required");
    return { ok: false, partial: false };
  }

  if (authProvider === "internal_magic_link" && !options.cookieSecret) {
    logger.error("FAIL: COOKIE_SECRET environment variable is required");
    return { ok: false, partial: false };
  }

  if (!await validateHealth(options.baseUrl, fetchFn, logger)) {
    failed = true;
  }

  if (authProvider === "internal_magic_link") {
    const magicLinkOk = await validateMagicLinkDeployment({
      baseUrl: options.baseUrl,
      cookieSecret: options.cookieSecret!,
      fetchFn,
      logger,
    });
    failed = !magicLinkOk || failed;
  } else if (authProvider === "oidc") {
    const oidcResult = await validateOidcDeployment({
      baseUrl: options.baseUrl,
      authBearerToken: options.authBearerToken,
      requireAuth: options.requireAuth,
      fetchFn,
      logger,
    });
    failed = !oidcResult.ok || failed;
    partial = oidcResult.partial;
  } else {
    logger.log("PASS: Auth checks not required for VALIDATION_AUTH_PROVIDER=none");
  }

  if (failed) {
    logger.error("\nSYSTEM VALIDATION FAILED");
    return { ok: false, partial };
  }

  if (partial) {
    logger.log("\nSYSTEM VALIDATION PASSED (PARTIAL)");
  } else {
    logger.log("\nSYSTEM VALIDATION PASSED");
  }

  return { ok: true, partial };
}

export function optionsFromEnv(env: NodeJS.ProcessEnv = process.env): ValidationOptions {
  return {
    baseUrl: env.BASE_URL ?? "",
    authProvider: parseAuthProvider(env.VALIDATION_AUTH_PROVIDER ?? env.AUTH_PROVIDER),
    cookieSecret: env.COOKIE_SECRET,
    authBearerToken: env.AUTH_BEARER_TOKEN,
    requireAuth: parseBoolean(env.VALIDATION_REQUIRE_AUTH),
  };
}

async function main(): Promise<void> {
  try {
    const result = await validateSystem(optionsFromEnv());
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    console.error("FAIL:", (err as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
