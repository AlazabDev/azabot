export const APP_ROLES = [
  "admin",
  "architect",
  "client",
  "consultant",
  "contractor",
  "viewer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}
