import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const MIN_JWT_SECRET_LENGTH = 32;

/** Validates JWT_SECRET is set and long enough. Called eagerly at startup
 *  (see instrumentation.ts) so a missing/weak secret fails the boot instead
 *  of surfacing later as a forgeable-token vulnerability at request time. */
export function requireJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.trim().length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is missing or shorter than ${MIN_JWT_SECRET_LENGTH} characters. ` +
        "Set a long random secret before starting the app (e.g. `openssl rand -base64 48`)."
    );
  }
  return value;
}

const secret = () => new TextEncoder().encode(requireJwtSecret());

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: string, email: string, role = "user"): Promise<string> {
  return new SignJWT({ email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("60d")
    .sign(secret());
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.sub),
      email: String(payload.email ?? ""),
      role: String(payload.role ?? "user"),
    };
  } catch {
    return null;
  }
}

/** Extract the bearer token from an Authorization header. */
export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}
