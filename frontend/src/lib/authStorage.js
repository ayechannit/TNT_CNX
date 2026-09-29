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

// Every formname that gates a screen. Kept in sync with the backend's
// SCREEN_PERMS (middleware/requireScreen.js) and App.jsx's ALL_SCREEN_PERMS.
const SCREEN_PERMS = [
  "FrmSale", "FrmSaleList",
  "FrmPurchase", "FrmPurchaseList",
  "FrmStockAdjust",
  "FrmTransfer", "FrmTransferList",
  "FrmReturn", "FrmReturnList",
  "FrmSaleReturn", "FrmSaleReturnList",
  "FrmStock", "FrmStockBalance",
  "FrmUser", "FrmUserRole",
  "FrmReport", "FrmSaleReport", "FrmPurchaseReport",
  "FrmExpense", "FrmExpenseType",
  "FrmCategory", "FrmSupplier", "FrmCustomer", "FrmBranch",
];

// A superuser can do everything: the "admin" account (by username), and any
// account with no screen permissions at all (legacy "unrestricted = full
// access"). Mirrors the backend's isSuperuser.
export function isSuperuser() {
  const user = getStoredUser();
  if (user && String(user.userName || "").toLowerCase() === "admin") return true;
  const perms = getPermissions();
  return !SCREEN_PERMS.some((p) => perms.includes(p));
}

// Whether the current user may perform an action (a formname from UserRole).
// UI-only convenience for hiding actions; the backend independently enforces
// the same check, so a tampered client still can't perform the action.
export function can(permission) {
  return isSuperuser() || getPermissions().includes(permission);
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
