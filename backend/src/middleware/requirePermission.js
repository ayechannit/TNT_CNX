const pool = require("../db/pool");
const { SCREEN_PERMS, isSuperuser } = require("./requireScreen");

// Gates an action behind a permission (a formname in the UserRole table).
// Must run after requireAuth so req.user is populated.
//
// Superusers bypass the check: the "admin" account, and any account with no
// screen permissions at all (the legacy "unrestricted = full access" rule),
// can do everything - so admin can delete even though it holds no explicit
// "Delete" permission.
//
// Deletes and other privileged actions are rare, so a per-request lookup is
// fine - and it always reflects the current permission set, so toggling a
// user's permission takes effect immediately without re-issuing tokens.
function requirePermission(formname) {
  return async function (req, res, next) {
    try {
      const user = req.user;
      if (!user || !user.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { rows } = await pool.query(
        `SELECT formname FROM "UserRole" WHERE userid = $1`,
        [user.userId]
      );
      const held = new Set(rows.map((r) => r.formname));
      if (isSuperuser(user, held) || held.has(formname)) {
        return next();
      }
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requirePermission;
