import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const MIN_JWT_SECRET_LENGTH = 32;

export const JWT_SECRET_ERROR =
  `JWT_SECRET is missing or shorter than ${MIN_JWT_SECRET_LENGTH} characters. ` +
  "Accounts and sync are switched off until a long random secret is set (e.g. `openssl rand -base64 48`).";

/** True when JWT_SECRET is long enough to sign tokens with. */
export function jwtSecretConfigured(): boolean {
  const value = process.env.JWT_SECRET;
  return !!value && value.trim().length >= MIN_JWT_SECRET_LENGTH;
}

/** Returns JWT_SECRET, throwing when it is missing or weak, so a token is never
 *  signed or accepted with a guessable key (verifyToken then returns null). */
export function requireJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || !jwtSecretConfigured()) {
    throw new Error(JWT_SECRET_ERROR);
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
