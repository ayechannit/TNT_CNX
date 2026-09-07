const pool = require("../db/pool");

async function getRoles(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT formname FROM "UserRole" WHERE userid = $1`,
      [req.params.userId]
    );
    res.json(rows.map((r) => r.formname));
  } catch (err) {
    next(err);
  }
}

async function setRoles(req, res, next) {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const formnames = Array.isArray(req.body.formnames) ? req.body.formnames : [];
    const user = req.body.user || "web";

    await client.query("BEGIN");
    await client.query(`DELETE FROM "UserRole" WHERE userid = $1`, [userId]);
    for (const formname of formnames) {
      await client.query(
        `INSERT INTO "UserRole" (userid, formname, createuser, createdate) VALUES ($1, $2, $3, now())`,
        [userId, formname, user]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { getRoles, setRoles };
