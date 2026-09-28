const pool = require("../db/pool");

// Every formname that gates a screen. Kept in sync with the frontend's
// ALL_SCREEN_PERMS (App.jsx). A user who holds NONE of these is treated as
// unrestricted (full access) - this is how the legacy "admin" account, which
// has zero UserRole rows, keeps working.
const SCREEN_PERMS = new Set([
  "FrmSale", "FrmSaleList",
  "FrmPurchase", "FrmPurchaseList",
  "FrmStockAdjust",
  "FrmTransfer", "FrmTransferList",
  "FrmReturn", "FrmReturnList",
  "FrmSaleReturn", "FrmSaleReturnList",
  "FrmStock", "FrmStockBalance",
  "FrmUser", "FrmUserRole",
  "FrmReport", "FrmSaleReport", "FrmPurchaseReport",
]);

// A superuser bypasses every permission check and can do everything:
//   - the "admin" account (by username), always; and
//   - any account with no screen permissions at all - the legacy
//     "unrestricted = full access" rule, which is why the admin account has
//     zero UserRole rows and still works.
// Keeping the admin username check means admin stays a superuser even if it is
// later assigned some permissions.
function isSuperuser(user, held) {
  if (user && String(user.userName || "").toLowerCase() === "admin") return true;
  return ![...SCREEN_PERMS].some((p) => held.has(p));
}

// Gates a whole screen's routes: the user must be a superuser, or hold at least
// one of `allowed` (any of the formnames that grant this screen). Must run
// after requireAuth.
//
// Mirrors the frontend nav gating so the menu and the API agree. Pass an empty
// array for a screen that has no assignable permission in this schema (e.g.
// Expense) - then only superusers may reach it.
//
// NOTE: shared lookup endpoints (branches, customers, suppliers, categories,
// stock) are intentionally NOT gated - transaction screens read them even when
// the user has no menu entry for that lookup, so gating them would break sales.
function requireScreen(allowed = []) {
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];
  return async function (req, res, next) {
    try {
      const user = req.user;
      if (!user || !user.userId) return res.status(401).json({ error: "Not authenticated" });

      const { rows } = await pool.query(
        `SELECT formname FROM "UserRole" WHERE userid = $1`,
        [user.userId]
      );
      const held = new Set(rows.map((r) => r.formname));

      if (isSuperuser(user, held)) return next();
      if (allowedList.some((p) => held.has(p))) return next();

      return res.status(403).json({ error: "You do not have permission to access this screen." });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requireScreen;
module.exports.SCREEN_PERMS = SCREEN_PERMS;
module.exports.isSuperuser = isSuperuser;
