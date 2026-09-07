const pool = require("../db/pool");

async function list(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT "CategoryID", "CategoryName" FROM "CategoryMaster" ORDER BY "CategoryName"`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
