import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesiones sin dependencias externas.
 *
 * La cookie contiene un payload JSON firmado con HMAC-SHA256 usando AUTH_SECRET.
 * La cookie es httpOnly, secure en produccion y sameSite=lax.
 *
 * La cookie NO contiene el hash de la contrasena ni ningun dato sensible.
 * El rol se vuelve a leer de base de datos en cada peticion, de modo que la
 * cookie nunca es la fuente de verdad de los permisos.
 */

export const SESSION_COOKIE_NAME = "penita_sesion";

export interface SessionPayload {
  /** Identificador del miembro. */
  sub: string;
  /** Slug del miembro, solo para trazas de interfaz. */
  slug: string;
  /** Emitida en (segundos epoch). */
  iat: number;
  /** Caduca en (segundos epoch). */
  exp: number;
  /** Valor aleatorio para que dos sesiones nunca sean identicas. */
  jti: string;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET no está configurado o es demasiado corto (mínimo 32 caracteres).");
  }
  return value;
}

export function sessionMaxAgeSeconds(): number {
  const parsed = Number.parseInt(process.env.SESSION_MAX_AGE_SECONDS ?? "43200", 10);
  if (Number.isNaN(parsed) || parsed < 300 || parsed > 2592000) return 43200;
  return parsed;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function createSessionToken(memberId: string, slug: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: memberId,
    slug,
    iat: now,
    exp: now + sessionMaxAgeSeconds(),
    jti: randomBytes(12).toString("base64url")
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string): SessionPayload | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(body))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as Partial<SessionPayload>;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (typeof payload.slug !== "string") return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(memberId: string, slug: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(memberId, slug),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds()
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function readSessionFromCookies(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return readSessionToken(raw);
}
