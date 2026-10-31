import { randomUUID } from "expo-crypto";

// The shared store makes ids with crypto.randomUUID (src/lib/id.ts); Hermes has
// no Web Crypto, so give it the native one rather than the Math.random fallback.
const g = globalThis as { crypto?: { randomUUID?: () => string } };
g.crypto ??= {};
g.crypto.randomUUID ??= randomUUID;
