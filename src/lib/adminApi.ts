const TOKEN_KEY = "azabot_admin_token";
const API_ORIGIN = (
  (import.meta.env.VITE_CHAT_API_URL as string | undefined) ||
  window.location.origin
).replace(/\/$/, "");

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function readJsonResponse(res: Response) {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("رد الخادم ليس JSON صالحًا");
  }
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_ORIGIN}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await readJsonResponse(res);
  if (!res.ok) throw new Error((data?.detail as string) || (data?.error as string) || "فشل الدخول");
  if (!data || !data.token || typeof data.token !== "string") {
    throw new Error("رد الدخول غير صالح");
  }
  adminToken.set(data.token);
  return data;
}

export function adminAssetUrl(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function adminApi<T = unknown>(
  action: string,
  opts: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const t = adminToken.get();
  if (!t) throw new Error("Not authenticated");
  const qs = new URLSearchParams({ action, ...(opts.query || {}) }).toString();
  const res = await fetch(`${API_ORIGIN}/admin/api?${qs}`, {
    method: opts.method || "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
    body: opts.method === "GET" ? undefined : JSON.stringify(opts.body || {}),
  });
  const data = await readJsonResponse(res);
  if (res.status === 401) {
    adminToken.clear();
    window.location.href = "/admin/login";
  }
  if (!res.ok) throw new Error((data?.detail as string) || (data?.error as string) || "خطأ");
  return (data ?? {}) as T;
}
