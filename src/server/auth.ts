import { createHash } from "crypto";
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

export const MIN_PASSWORD_LENGTH = 8;

/** Server-side password policy; returns an error message or null. */
export function passwordProblem(plain: unknown): string | null {
  if (typeof plain !== "string" || plain.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (plain.length > 200) return "That password is too long.";
  return null;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 11);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Session token. `tv` is the user's token_version at issue time; bumping the
 * column (password reset, "sign out everywhere") revokes every older token.
 * Role is deliberately not a claim: callers read it from the database.
 */
export function signToken(userId: string, email: string, _role = "user", version = 0): Promise<string> {
  return new SignJWT({ email, tv: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; email: string; version: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      userId: String(payload.sub),
      email: String(payload.email ?? ""),
      version: typeof payload.tv === "number" ? payload.tv : 0,
    };
  } catch {
    return null;
  }
}

/** Reset tokens are stored hashed; only the emailed link carries the secret. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
