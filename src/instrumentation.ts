// Runs once at server boot (both `next dev` and `next start`/standalone),
// before any request is served. Reports missing/weak config up front.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { jwtSecretConfigured, JWT_SECRET_ERROR } = await import("@/server/auth");
    // A weak secret disables accounts (sign-in/up return 503, tokens never
    // verify) but must not take the whole local-first app down: exiting here
    // crash-looped the container on every deploy with a placeholder secret.
    if (!jwtSecretConfigured()) console.error(`[config] ${JWT_SECRET_ERROR}`);
  }
}
