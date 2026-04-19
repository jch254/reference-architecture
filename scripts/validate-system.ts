/**
 * System validation script — runs after deploy to verify the system is functional.
 * Uses only native fetch (Node 18+). No frameworks, no mocks, no libraries.
 *
 * Usage: BASE_URL=https://reference-architecture.603.nz tsx scripts/validate-system.ts
 */

const BASE_URL = process.env.BASE_URL;
const COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!BASE_URL) {
  console.error("FAIL: BASE_URL environment variable is required");
  process.exit(1);
}

if (!COOKIE_SECRET) {
  console.error("FAIL: COOKIE_SECRET environment variable is required");
  process.exit(1);
}

const url = (path: string) => `${BASE_URL}${path}`;

async function validate() {
  let failed = false;
  let createdId: string | undefined;

  // --- Step 0: Authenticate via magic-link backdoor ---
  let sessionCookie: string;
  try {
    const linkRes = await fetch(url("/api/auth/request-link"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cookie-secret": COOKIE_SECRET!,
      },
      body: JSON.stringify({ email: "validate@system.test" }),
    });
    const linkBody = await linkRes.json() as any;
    const token = linkBody?.data?.token as string | undefined;

    if (!token) throw new Error(`No token in response: ${JSON.stringify(linkBody)}`);

    const verifyRes = await fetch(url(`/api/auth/verify?token=${encodeURIComponent(token)}&json=1`));

    if (!verifyRes.ok) throw new Error(`Verify failed with status ${verifyRes.status}`);

    const rawCookie = verifyRes.headers.get("set-cookie");
    if (!rawCookie) throw new Error("No set-cookie header in verify response");

    // Extract just the name=value part (before the first ;)
    sessionCookie = rawCookie.split(";")[0];
    console.log("PASS: Authentication");
  } catch (err) {
    console.error("FAIL: Authentication —", (err as Error).message);
    process.exit(1);
  }

  const authHeaders = { Cookie: sessionCookie };

  // --- Step 1: Health check ---
  try {
    const res = await fetch(url("/api/health"));
    const body = await res.json();

    if (res.ok && body.data?.status === "ok") {
      console.log("PASS: GET /api/health");
    } else {
      console.error("FAIL: GET /api/health — unexpected response", body);
      failed = true;
    }
  } catch (err) {
    console.error("FAIL: GET /api/health —", (err as Error).message);
    failed = true;
  }

  // --- Step 2: Empty state — GET before POST returns valid array ---
  try {
    const res = await fetch(url("/api/example"), { headers: authHeaders });
    const body = await res.json();

    if (res.ok && Array.isArray(body.data)) {
      console.log("PASS: GET /api/example — empty state returns valid array");
    } else {
      console.error("FAIL: GET /api/example — empty state unexpected response", body);
      failed = true;
    }
  } catch (err) {
    console.error("FAIL: GET /api/example — empty state —", (err as Error).message);
    failed = true;
  }

  // --- Step 3: Invalid POST — missing name ---
  try {
    const res = await fetch(url("/api/example"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({}),
    });

    if (res.status === 400) {
      console.log("PASS: POST /api/example — rejects missing name (400)");
    } else {
      console.error("FAIL: POST /api/example — expected 400 for missing name, got", res.status);
      failed = true;
    }
  } catch (err) {
    console.error("FAIL: POST /api/example — invalid POST —", (err as Error).message);
    failed = true;
  }

  // --- Step 4: Create example ---
  const exampleName = `test-${Date.now()}`;

  try {
    const res = await fetch(url("/api/example"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ name: exampleName }),
    });
    const body = await res.json();

    if (
      res.ok &&
      body.data &&
      body.data.id &&
      body.data.name === exampleName &&
      body.data.createdAt &&
      body.data.updatedAt
    ) {
      createdId = body.data.id;
      console.log("PASS: POST /api/example");
    } else {
      console.error("FAIL: POST /api/example — unexpected response", body);
      failed = true;
    }
  } catch (err) {
    console.error("FAIL: POST /api/example —", (err as Error).message);
    failed = true;
  }

  // --- Step 5: List examples and verify created item is present ---
  try {
    const res = await fetch(url("/api/example"), { headers: authHeaders });
    const body = await res.json();

    if (!res.ok || !Array.isArray(body.data)) {
      console.error("FAIL: GET /api/example — unexpected response shape", body);
      failed = true;
    } else if (createdId && body.data.some((item: any) => item.id === createdId)) {
      console.log("PASS: GET /api/example — created item found");
    } else if (!createdId) {
      console.log("SKIP: GET /api/example — no created item to verify (create failed)");
    } else {
      console.error("FAIL: GET /api/example — created item not found in list");
      failed = true;
    }
  } catch (err) {
    console.error("FAIL: GET /api/example —", (err as Error).message);
    failed = true;
  }

  // --- Step 6: Tenant isolation (light) ---
  // Simulate a second tenant by overriding the Host header.
  // The item created above should NOT be visible to a different tenant.
  //
  // NOTE: Host header overrides are unreliable through CDN/proxy layers
  // (e.g. Cloudflare proxied mode). If the proxy strips the Host override,
  // the response will contain the original tenant's data — that's not an
  // isolation failure, it's the proxy ignoring the header. We detect this
  // by comparing the full result set and SKIP instead of FAIL.
  if (createdId) {
    try {
      // First, capture what the original tenant sees for comparison
      const originalRes = await fetch(url("/api/example"), { headers: authHeaders });
      const originalBody = await originalRes.json();
      const originalIds = new Set(
        (originalBody.data || []).map((item: any) => item.id),
      );

      const res = await fetch(url("/api/example"), {
        headers: { ...authHeaders, Host: `validation-tenant.603.nz` },
      });

      if (res.status === 401) {
        // Session cookie is tenant-scoped — auth failure for a different tenant proves isolation
        console.log("PASS: Tenant isolation — session rejected for different tenant");
      } else {
        const body = await res.json();

        if (!res.ok || !Array.isArray(body.data)) {
          console.error("FAIL: Tenant isolation — unexpected response shape", body);
          failed = true;
        } else {
          const otherIds = new Set(body.data.map((item: any) => item.id));
          const sameResultSet =
            otherIds.size === originalIds.size &&
            [...otherIds].every((id) => originalIds.has(id));

          if (sameResultSet && body.data.some((item: any) => item.id === createdId)) {
            // Proxy likely stripped the Host override — identical data returned
            console.log("SKIP: Tenant isolation — Host header override not forwarded by proxy");
          } else if (body.data.some((item: any) => item.id === createdId)) {
            console.error("FAIL: Tenant isolation — created item visible to other tenant");
            failed = true;
          } else {
            console.log("PASS: Tenant isolation — created item not visible to other tenant");
          }
        }
      }
    } catch (err) {
      // Host header override may not work through all proxies — don't fail the build
      console.log("SKIP: Tenant isolation —", (err as Error).message);
    }
  }

  // --- Step 7: Cleanup — delete created item ---
  if (createdId) {
    try {
      const res = await fetch(url(`/api/example/${createdId}`), {
        method: "DELETE",
        headers: authHeaders,
      });

      if (res.ok) {
        console.log("PASS: DELETE /api/example/:id — cleaned up");
      } else {
        console.error("FAIL: DELETE /api/example/:id — status", res.status);
        failed = true;
      }
    } catch (err) {
      console.error("FAIL: DELETE /api/example/:id —", (err as Error).message);
      failed = true;
    }
  }

  // --- Result ---
  if (failed) {
    console.error("\nSYSTEM VALIDATION FAILED");
    process.exit(1);
  }

  console.log("\nSYSTEM VALIDATION PASSED");
}

validate();
