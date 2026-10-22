const pool = require("../db/pool");
const { SQL_NOW, localNow } = require("../lib/localTime");
const { changeStockBalance, itemErrors } = require("../lib/stockBalance");
const { parsePagination } = require("../lib/pagination");

// SaleReturn has no code generator of its own - it reuses the original
// sale's SaleCode for its Payment row (tablename SALERETURN), matching
// legacy SaleReturn.cs exactly.

async function list(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || "").trim();
    const branchId = req.query.branchId;
    const params = [];
    let where = "1=1";
    if (branchId) {
      params.push(branchId);
      where += ` AND h."BranchID" = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (h."SaleCode" ILIKE $${params.length} OR p."PatientName" ILIKE $${params.length})`;
    }
    if (req.query.fromDate) {
      params.push(req.query.fromDate);
      where += ` AND h."ReturnDate"::date >= $${params.length}`;
    }
    if (req.query.toDate) {
      params.push(req.query.toDate);
      where += ` AND h."ReturnDate"::date <= $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM "SaleReturnHDR" h
       LEFT JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
       WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT h."SaleReturnHDRID", h."SaleCode", h."ReturnDate", h."PatientID", p."PatientName",
              h."PrevAmount", h."PrevLeftover", h."ReturnAmount", h."ReturnBalance", h."Note", h."BranchID"
       FROM "SaleReturnHDR" h
       LEFT JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
       WHERE ${where}
       ORDER BY h."SaleReturnHDRID" DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );
    res.json({ data: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT h.*, p."PatientName" FROM "SaleReturnHDR" h
       LEFT JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
       WHERE h."SaleReturnHDRID" = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    const detailRes = await pool.query(
      `SELECT d.*, st."StockName", st."StockCode" AS "StockItemCode" FROM "SaleReturnDtl" d
       LEFT JOIN "StockMaster" st ON st."StockID" = d."StockID"
       WHERE d."SaleReturnHdrID" = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], items: detailRes.rows });
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const errors = [];
  if (!body.saleId) errors.push("A sale must be selected");
  if (!Array.isArray(body.items) || body.items.length === 0) errors.push("At least one item is required");
  errors.push(...itemErrors(body.items));
  return errors;
}

// Each stock item can only be returned up to what this sale sold, minus what
// earlier returns of the same sale already gave back - otherwise a repeat or
// oversized return would add stock that never came back.
async function returnQtyError(client, saleId, saleCode, items) {
  const soldRes = await client.query(
    `SELECT d."StockCode"::int AS "StockID", SUM(d."Qty") AS "Qty", MAX(st."StockCode") AS "Code"
     FROM "SaleDtl" d LEFT JOIN "StockMaster" st ON st."StockID" = d."StockCode"::int
     WHERE d."SaleHDRID" = $1 GROUP BY 1`,
    [saleId]
  );
  const returnedRes = await client.query(
    `SELECT d."StockID", SUM(d."Qty") AS "Qty" FROM "SaleReturnDtl" d
     JOIN "SaleReturnHDR" h ON h."SaleReturnHDRID" = d."SaleReturnHdrID"
     WHERE h."SaleCode" = $1 GROUP BY 1`,
    [saleCode]
  );
  const sold = new Map(soldRes.rows.map((r) => [Number(r.StockID), r]));
  const returned = new Map(returnedRes.rows.map((r) => [Number(r.StockID), Number(r.Qty)]));
  const requested = new Map();
  for (const it of items) requested.set(Number(it.stockId), (requested.get(Number(it.stockId)) || 0) + Number(it.qty));

  for (const [stockId, qty] of requested) {
    const line = sold.get(stockId);
    if (!line) return "An item being returned is not part of this sale.";
    const left = Number(line.Qty) - (returned.get(stockId) || 0);
    if (qty > left) return `${line.Code}: only ${Math.max(left, 0)} left to return from this sale.`;
  }
  return null;
}

// Returns items from an existing paid/leftover sale: increments stock back,
// sets the original SaleHdr.Status to RETURN, and logs a SALERETURN payment
// under the ORIGINAL sale code for (returnAmount + prevLeftover) - matches
// legacy Save_Data() in SaleReturn.cs exactly, including the quirk that the
// whole sale's status flips to RETURN even for a partial-item return.
async function create(req, res, next) {
  const body = req.body;
  const errors = validate(body);
  if (errors.length) return res.status(400).json({ errors });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const saleRes = await client.query(
      `SELECT "SaleCode","PatientID","TotalAmount","LeftOver","BranchID" FROM "SaleHdr" WHERE "SaleID" = $1 FOR UPDATE`,
      [body.saleId]
    );
    if (saleRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Sale not found" }); }
    const sale = saleRes.rows[0];

    const qtyError = await returnQtyError(client, body.saleId, sale.SaleCode, body.items);
    if (qtyError) { await client.query("ROLLBACK"); return res.status(400).json({ errors: [qtyError] }); }

    const user = body.user || "web";
    const returnDate = localNow();
    const returnAmount = body.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.price), 0);
    const prevLeftover = Number(sale.LeftOver) || 0;
    const returnBalance = returnAmount + prevLeftover;

    const hdrRes = await client.query(
      `INSERT INTO "SaleReturnHDR"
        ("SaleCode","ReturnDate","PatientID","PrevAmount","PrevLeftover","ReturnAmount","ReturnBalance","Note",
         "CreateUser","CreateDate","UpdateUser","UpdateDate","BranchID")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${SQL_NOW},$9,${SQL_NOW},$10)
       RETURNING "SaleReturnHDRID"`,
      [sale.SaleCode, returnDate, sale.PatientID, sale.TotalAmount, prevLeftover, returnAmount, returnBalance,
        body.note || null, user, sale.BranchID]
    );
    const saleReturnId = hdrRes.rows[0].SaleReturnHDRID;

    for (const item of body.items) {
      const amount = Number(item.qty) * Number(item.price);
      await client.query(
        `INSERT INTO "SaleReturnDtl"
          ("SaleReturnHdrID","StockID","Qty","Price","Amount","CreateUser","CreateDate","UpdateUser","UpdateDate")
         VALUES ($1,$2,$3,$4,$5,$6,${SQL_NOW},$6,${SQL_NOW})`,
        [saleReturnId, item.stockId, item.qty, item.price, amount, user]
      );
      await changeStockBalance(client, item.stockId, sale.BranchID, item.qty);
    }

    await client.query(`UPDATE "SaleHdr" SET "Status" = 'RETURN' WHERE "SaleCode" = $1`, [sale.SaleCode]);

    await client.query(
      `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
       VALUES ($1, ${SQL_NOW}, $2, 'SALERETURN', $3, ${SQL_NOW}, $4)`,
      [sale.SaleCode, returnBalance, user, sale.BranchID]
    );

    await client.query("COMMIT");
    res.status(201).json({ saleReturnId, saleCode: sale.SaleCode, returnAmount, returnBalance });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// Deletes a sale return: reverses the stock increase, removes the
// SALERETURN payment row and header/detail rows, and resets the sale's
// Status back to PAID - matches legacy SaleReturnList.DeleteSaleReturn
// exactly (it unconditionally sets PAID, regardless of original leftover).
async function remove(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    const hdrRes = await client.query(`SELECT "SaleCode","BranchID" FROM "SaleReturnHDR" WHERE "SaleReturnHDRID" = $1`, [id]);
    if (hdrRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Sale return not found" }); }
    const hdr = hdrRes.rows[0];

    const detailRes = await client.query(`SELECT "StockID","Qty" FROM "SaleReturnDtl" WHERE "SaleReturnHdrID" = $1`, [id]);
    for (const d of detailRes.rows) {
      await changeStockBalance(client, d.StockID, hdr.BranchID, -d.Qty);
    }

    await client.query(`DELETE FROM "Payment" WHERE code = $1 AND tablename = 'SALERETURN'`, [hdr.SaleCode]);
    await client.query(`DELETE FROM "SaleReturnDtl" WHERE "SaleReturnHdrID" = $1`, [id]);
    await client.query(`DELETE FROM "SaleReturnHDR" WHERE "SaleReturnHDRID" = $1`, [id]);
    await client.query(`UPDATE "SaleHdr" SET "Status" = 'PAID' WHERE "SaleCode" = $1`, [hdr.SaleCode]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, remove };
