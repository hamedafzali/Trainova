// Runs once at server boot (both `next dev` and `next start`/standalone),
// before any request is served. Used to fail fast on missing/weak config
// instead of only discovering it when a request path hits it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { requireJwtSecret } = await import("@/server/auth");
    try {
      requireJwtSecret();
    } catch (err) {
      // Next.js logs a thrown instrumentation error but otherwise keeps the
      // process alive, serving 500s forever instead of refusing to boot.
      // Exit outright so a bad/missing secret is an unmissable crash, not a
      // quiet runtime failure (restart: unless-stopped will crash-loop it
      // with this message in the logs until the secret is fixed).
      console.error((err as Error).message);
      process.exit(1);
    }
  }
}
