// The shop's timestamp columns are "timestamp without time zone" holding
// local wall-clock time, but the Supabase session runs in UTC - so a bare
// now() (or a JS toISOString()) would store UTC and show 7 hours behind.
// Everything that stamps the current time goes through these instead.
const SHOP_TZ = "Asia/Bangkok";

// SQL expression for the current shop-local wall-clock time.
const SQL_NOW = `(now() AT TIME ZONE '${SHOP_TZ}')`;

// Current shop-local time as "YYYY-MM-DD HH:MM:SS".
function localNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: SHOP_TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

// Current shop-local date as "YYYY-MM-DD".
function localToday() {
  return localNow().slice(0, 10);
}

module.exports = { SHOP_TZ, SQL_NOW, localNow, localToday };
