const pool = require("../db/pool");

// Gates an action behind a permission (a formname in the UserRole table).
// Must run after requireAuth so req.user is populated.
//
// Deletes and other privileged actions are rare, so a per-request lookup is
// fine - and it always reflects the current permission set, so an admin
// toggling a user's permission takes effect immediately without having to
// bake roles into the JWT and re-issue tokens.
function requirePermission(formname) {
  return async function (req, res, next) {
    try {
      const userId = req.user && req.user.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { rows } = await pool.query(
        `SELECT 1 FROM "UserRole" WHERE userid = $1 AND formname = $2 LIMIT 1`,
        [userId, formname]
      );
      if (rows.length === 0) {
        return res.status(403).json({ error: "You do not have permission to perform this action." });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requirePermission;
