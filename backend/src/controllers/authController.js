const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "12h";

// Legacy WinForms passwords are stored as plain text (see MPOS/UX/Others/Login.cs).
// New/rehashed passwords are bcrypt, which always starts with "$2". Accept
// either so existing accounts keep working, and silently upgrade a plain-text
// match to a bcrypt hash on successful login.
async function verifyPassword(candidate, stored, userId) {
  if (!stored) return false;
  if (stored.startsWith("$2")) {
    return bcrypt.compare(candidate, stored);
  }
  if (candidate !== stored) return false;
  const hash = await bcrypt.hash(candidate, 10);
  await pool.query(`UPDATE "UserMaster" SET "Password" = $1 WHERE "UserID" = $2`, [hash, userId]);
  return true;
}

async function login(req, res, next) {
  try {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const { rows } = await pool.query(
      `SELECT "UserID", "RealName", "UserName", "Password", "Active"
       FROM "UserMaster" WHERE "UserName" = $1`,
      [username]
    );
    const user = rows[0];
    const ok = user && (await verifyPassword(password, user.Password, user.UserID));
    if (!ok) {
      return res.status(401).json({ error: "Username or password is incorrect" });
    }
    if (user.Active !== "Y") {
      return res.status(403).json({ error: "This account has been disabled. Contact your administrator." });
    }

    const { rows: roleRows } = await pool.query(
      `SELECT formname FROM "UserRole" WHERE userid = $1`,
      [user.UserID]
    );

    const token = jwt.sign(
      { userId: user.UserID, userName: user.UserName, realName: user.RealName },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL }
    );

    res.json({
      token,
      user: { userId: user.UserID, userName: user.UserName, realName: user.RealName },
      formNames: roleRows.map((r) => r.formname),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
