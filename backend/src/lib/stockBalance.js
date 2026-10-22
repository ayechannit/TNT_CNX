// Serializes changes to one stock's balance at one branch until the caller's
// transaction ends. "StockBalance" has no unique key, so this is what stops
// two saves from both creating the row for the same stock+branch.
async function lockStockBalance(client, stockId, branchId) {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [`stockbalance:${Number(stockId)}:${Number(branchId)}`]);
}

// Adds delta (negative to subtract) to a stock's balance at a branch.
// A stock has no "StockBalance" row for a branch until something first moves
// it there, and a bare UPDATE on a missing row silently does nothing - so a
// new item's first purchase used to be lost. This creates the row instead.
// Must be called inside the caller's transaction.
async function changeStockBalance(client, stockId, branchId, delta) {
  const qty = Number(delta);
  const sql = `UPDATE "StockBalance" SET "Qty" = "Qty" + $1 WHERE "StockID" = $2 AND "BranchID" = $3`;
  const upd = await client.query(sql, [qty, stockId, branchId]);
  if (upd.rowCount > 0) return;

  // No row yet: take the lock and re-check, in case another save created
  // the row in the meantime.
  await lockStockBalance(client, stockId, branchId);
  const retry = await client.query(sql, [qty, stockId, branchId]);
  if (retry.rowCount > 0) return;
  await client.query(
    `INSERT INTO "StockBalance" ("StockID","Qty","BranchID") VALUES ($1,$2,$3)`,
    [stockId, qty, branchId]
  );
}

// Validation shared by every voucher that moves stock: each line needs a
// stock item and a positive quantity (a zero/negative/blank qty would move
// stock the wrong way or not at all).
function itemErrors(items) {
  if (!Array.isArray(items)) return [];
  const errors = [];
  if (items.some((it) => !it || !it.stockId)) errors.push("Every item must be a stock item");
  if (items.some((it) => !(Number(it && it.qty) > 0))) errors.push("Every item quantity must be greater than 0");
  return errors;
}

module.exports = { lockStockBalance, changeStockBalance, itemErrors };
