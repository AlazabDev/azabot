const TOKEN_KEY = "azabot_admin_token";
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function adminLogin(password: string, action?: "setup") {
  const res = await fetch(`${BASE}/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ password, action }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "فشل الدخول");
  adminToken.set(data.token);
  return data;
}

export async function adminApi(action: string, opts: { method?: string; body?: any; query?: Record<string, string> } = {}) {
  const t = adminToken.get();
  if (!t) throw new Error("Not authenticated");
  const qs = new URLSearchParams({ action, ...(opts.query || {}) }).toString();
  const res = await fetch(`${BASE}/admin-api?${qs}`, {
    method: opts.method || "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: opts.method === "GET" ? undefined : JSON.stringify(opts.body || {}),
  });
  const data = await res.json();
  if (res.status === 401) {
    adminToken.clear();
    window.location.href = "/admin/login";
  }
  if (!res.ok) throw new Error(data.error || "خطأ");
  return data;
}
