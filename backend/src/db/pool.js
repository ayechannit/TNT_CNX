const { Pool, types } = require("pg");

// This schema's "timestamp" columns (SaleDate, deliverydate, CreateDate, etc.)
// are all "timestamp without time zone" - plain wall-clock values with no
// timezone meaning. pg's default behavior parses them into JS Date objects
// using the server process's local timezone, and JSON.stringify then calls
// .toISOString(), which silently shifts the value by the server's UTC offset.
// Returning the raw string instead avoids that corruption entirely.
const TIMESTAMP_OID = 1114;
const DATE_OID = 1082;
types.setTypeParser(TIMESTAMP_OID, (value) => value);
types.setTypeParser(DATE_OID, (value) => value);

// On Vercel each serverless function instance gets its own pool, and many
// can run concurrently - a generous per-instance pool size multiplies into
// far more Postgres connections than a small plan allows. Keep it tight
// there; local dev (a single long-running process) can use the pg default.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.VERCEL ? 1 : undefined,
});

module.exports = pool;
