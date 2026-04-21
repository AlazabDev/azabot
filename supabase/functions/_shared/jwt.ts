// Minimal HS256 JWT implementation for admin auth
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? enc.encode(bytes) : bytes;
  let str = btoa(String.fromCharCode(...b));
  return str.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return new Uint8Array(atob(s).split("").map((c) => c.charCodeAt(0)));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

export async function signJWT(payload: Record<string, unknown>, secret: string, expiresInSec = 60 * 60 * 24 * 7): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(body));
  const sig = await hmac(secret, `${headerB64}.${payloadB64}`);
  return `${headerB64}.${payloadB64}.${b64url(sig)}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const expected = await hmac(secret, `${h}.${p}`);
    const actual = b64urlDecode(s);
    if (expected.length !== actual.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
    if (diff !== 0) return null;
    const payload = JSON.parse(dec.decode(b64urlDecode(p)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const data = enc.encode(password);
  const combined = new Uint8Array(salt.length + data.length);
  combined.set(salt); combined.set(data, salt.length);
  const hash = await crypto.subtle.digest("SHA-256", combined);
  return `${b64url(salt)}.${b64url(new Uint8Array(hash))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [saltB64, hashB64] = stored.split(".");
    const salt = b64urlDecode(saltB64);
    const data = enc.encode(password);
    const combined = new Uint8Array(salt.length + data.length);
    combined.set(salt); combined.set(data, salt.length);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", combined));
    const expected = b64urlDecode(hashB64);
    if (hash.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
