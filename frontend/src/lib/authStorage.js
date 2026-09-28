const TOKEN_KEY = "mpos-auth-token";
const USER_KEY = "mpos-auth-user";
const PERMS_KEY = "mpos-auth-perms";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setAuth(token, user, permissions = []) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PERMS_KEY, JSON.stringify(permissions || []));
  } catch {
    // localStorage unavailable (private browsing, etc.) - session just won't persist across reloads.
  }
}

export function getPermissions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PERMS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Whether the current user holds a permission (a formname from UserRole).
// UI-only convenience for hiding actions; the backend independently enforces
// the same check, so a tampered client still can't perform the action.
export function can(permission) {
  return getPermissions().includes(permission);
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMS_KEY);
  } catch {
    // ignore
  }
}
