const pool = require("../db/pool");
const { parsePagination } = require("../lib/pagination");

async function list(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || "").trim();
    const params = [];
    let where = "1=1";
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (s."StockName" ILIKE $${params.length} OR s."StockCode" ILIKE $${params.length})`;
    }
    if (req.query.fromDate) {
      params.push(req.query.fromDate);
      where += ` AND a."AdjustmentDate"::date >= $${params.length}`;
    }
    if (req.query.toDate) {
      params.push(req.query.toDate);
      where += ` AND a."AdjustmentDate"::date <= $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM "Adjustment" a JOIN "StockMaster" s ON a."StockID" = s."StockID" WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT a."AdjustmentID", a."AdjustmentDate", a."StockID", s."StockCode", s."StockName",
              a."CurrentQty", a."AdjustedQty", a."CreateUser", a."BranchID"
       FROM "Adjustment" a
       JOIN "StockMaster" s ON a."StockID" = s."StockID"
       WHERE ${where}
       ORDER BY a."AdjustmentID" DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );
    res.json({ data: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 });
  } catch (err) {
    next(err);
  }
}

async function getBalance(req, res, next) {
  try {
    const { stockId } = req.params;
    const { branchId } = req.query;
    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }
    const { rows } = await pool.query(
      `SELECT "Qty" FROM "StockBalance" WHERE "StockID" = $1 AND "BranchID" = $2`,
      [stockId, branchId]
    );
    res.json({ qty: rows.length > 0 ? Number(rows[0].Qty) : 0 });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  const { stockId, branchId, newQty, user } = req.body;
  if (!stockId || !branchId) return res.status(400).json({ errors: ["Stock item and branch are required"] });
  if (newQty === undefined || newQty === null || newQty === "") {
    return res.status(400).json({ errors: ["New Stock Level can not be blank"] });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const balRes = await client.query(
      `SELECT "Qty" FROM "StockBalance" WHERE "StockID" = $1 AND "BranchID" = $2 FOR UPDATE`,
      [stockId, branchId]
    );
    const currentQty = balRes.rows.length > 0 ? Number(balRes.rows[0].Qty) : 0;
    const adjustedQty = Number(newQty);

    const insRes = await client.query(
      `INSERT INTO "Adjustment"
        ("AdjustmentDate","StockID","CurrentQty","AdjustedQty","CreateUser","CreateDate","UpdateUser","UpdateDate","BranchID")
       VALUES (now(),$1,$2,$3,$4,now(),$4,now(),$5)
       RETURNING "AdjustmentID"`,
      [stockId, currentQty, adjustedQty, user || "web", branchId]
    );

    if (balRes.rows.length > 0) {
      await client.query(`UPDATE "StockBalance" SET "Qty" = $1 WHERE "StockID" = $2 AND "BranchID" = $3`, [adjustedQty, stockId, branchId]);
    } else {
      await client.query(`INSERT INTO "StockBalance" ("StockID","Qty","BranchID") VALUES ($1,$2,$3)`, [stockId, adjustedQty, branchId]);
    }

    await client.query("COMMIT");
    res.status(201).json({ adjustmentId: insRes.rows[0].AdjustmentID, currentQty, adjustedQty });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { list, getBalance, create };
