const pool = require("../db/pool");
const { parsePagination } = require("../lib/pagination");

// Replicates Gen_NewPurchaseId: BranchNo + "_P" + YYYYMMDD + 4-digit sequence.
async function generatePurchaseCode(client, branchId, date) {
  const branchRes = await client.query(`SELECT branchno FROM "Branch" WHERE id = $1`, [branchId]);
  const branchNo = branchRes.rows[0]?.branchno || "BR";

  await client.query(
    `INSERT INTO "PurchaseNumberGenerator" ("CreatedDate", "BranchId") VALUES ($1, $2)`,
    [date, branchId]
  );
  const seqRes = await client.query(
    `SELECT COUNT(*) FROM "PurchaseNumberGenerator" WHERE "BranchId" = $1 AND "CreatedDate" = $2`,
    [branchId, date]
  );
  const seq = parseInt(seqRes.rows[0].count, 10);
  const yyyymmdd = date.replace(/-/g, "");
  const seqPadded = String(seq).padStart(4, "0").slice(-4);
  return `${branchNo}_P${yyyymmdd}${seqPadded}`;
}

async function list(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || "").trim();
    const view = req.query.view || "all"; // all | paid | unpaid
    const params = [];
    let where = "1=1";
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (h."PurchaseCode" ILIKE $${params.length} OR s."SupplierName" ILIKE $${params.length})`;
    }
    if (view === "paid") where += ` AND h."Status" = 'PAID'`;
    if (view === "unpaid") where += ` AND h."Status" = 'LEFTOVER'`;
    if (req.query.fromDate) {
      params.push(req.query.fromDate);
      where += ` AND h."PurchaseDate"::date >= $${params.length}`;
    }
    if (req.query.toDate) {
      params.push(req.query.toDate);
      where += ` AND h."PurchaseDate"::date <= $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM "PurchaseHdr" h
       LEFT JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
       WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT h."PurchaseID", h."PurchaseCode", h."PurchaseDate", h."SupplierID", s."SupplierName",
              h."Discount", h."Tax", h."TotalAmount", h."Paid", h."LeftOver", h."Status", h."BranchID"
       FROM "PurchaseHdr" h
       LEFT JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
       WHERE ${where}
       ORDER BY h."PurchaseID" DESC
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
      `SELECT h.*, s."SupplierName" FROM "PurchaseHdr" h
       LEFT JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
       WHERE h."PurchaseID" = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    const detailRes = await pool.query(
      `SELECT d.*, st."StockName" FROM "PurchaseDtl" d
       LEFT JOIN "StockMaster" st ON st."StockID" = d."StockCode"::int
       WHERE d."PurchaseHDRID" = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], items: detailRes.rows });
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const errors = [];
  if (!body.supplierId) errors.push("Supplier is required");
  if (!body.branchId) errors.push("Branch is required");
  if (!Array.isArray(body.items) || body.items.length === 0) errors.push("At least one item is required");
  return errors;
}

async function create(req, res, next) {
  const body = req.body;
  const errors = validate(body);
  if (errors.length) return res.status(400).json({ errors });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const purchaseDate = body.purchaseDate || new Date().toISOString().slice(0, 10);
    const user = body.user || "web";
    const discount = Number(body.discount) || 0;
    const tax = Number(body.tax) || 0;
    const itemsTotal = body.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.price), 0);
    const totalAmount = itemsTotal - discount + tax;
    const paid = Number(body.paid) || 0;
    const leftover = totalAmount - paid;
    const status = leftover > 0 ? "LEFTOVER" : "PAID";

    const purchaseCode = await generatePurchaseCode(client, body.branchId, purchaseDate);

    const hdrRes = await client.query(
      `INSERT INTO "PurchaseHdr"
        ("PurchaseCode","VoucherNo","PurchaseDate","SupplierID","Discount","Tax","TotalAmount","Paid","LeftOver","Note",
         "Status","CreateUser","CreateDate","UpdateUser","UpdateDate","BranchID")
       VALUES ($1,'0',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$11,now(),$12)
       RETURNING "PurchaseID"`,
      [purchaseCode, purchaseDate, body.supplierId, discount, tax, totalAmount, paid, leftover,
        body.note || null, status, user, body.branchId]
    );
    const purchaseId = hdrRes.rows[0].PurchaseID;

    for (const item of body.items) {
      const amount = Number(item.qty) * Number(item.price);
      await client.query(
        `INSERT INTO "PurchaseDtl"
          ("PurchaseHDRID","StockCode","Qty","Price","Amount","CreateUser","CreateDate","UpdateUser","UpdateDate")
         VALUES ($1,$2,$3,$4,$5,$6,now(),$6,now())`,
        [purchaseId, String(item.stockId), item.qty, item.price, amount, user]
      );
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" + $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [item.qty, item.stockId, body.branchId]
      );
    }

    if (paid !== 0) {
      await client.query(
        `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
         VALUES ($1,$2,$3,'PURCHASE',$4,now(),$5)`,
        [purchaseCode, purchaseDate, paid, user, body.branchId]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ purchaseId, purchaseCode, totalAmount, paid, leftover, status });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// Edits a purchase: reverses the old items' stock effect, replaces
// header/detail/payment rows, and re-applies the new items' stock effect.
async function update(req, res, next) {
  const body = req.body;
  const errors = validate(body);
  if (errors.length) return res.status(400).json({ errors });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;

    const existingRes = await client.query(`SELECT "PurchaseCode","BranchID" FROM "PurchaseHdr" WHERE "PurchaseID" = $1`, [id]);
    if (existingRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Purchase not found" }); }
    const existing = existingRes.rows[0];

    const oldItemsRes = await client.query(`SELECT "StockCode","Qty" FROM "PurchaseDtl" WHERE "PurchaseHDRID" = $1`, [id]);
    for (const d of oldItemsRes.rows) {
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" - $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [d.Qty, d.StockCode, existing.BranchID]
      );
    }

    await client.query(`DELETE FROM "PurchaseDtl" WHERE "PurchaseHDRID" = $1`, [id]);
    await client.query(`DELETE FROM "Payment" WHERE code = $1`, [existing.PurchaseCode]);

    const purchaseDate = body.purchaseDate || new Date().toISOString().slice(0, 10);
    const user = body.user || "web";
    const discount = Number(body.discount) || 0;
    const tax = Number(body.tax) || 0;
    const itemsTotal = body.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.price), 0);
    const totalAmount = itemsTotal - discount + tax;
    const paid = Number(body.paid) || 0;
    const leftover = totalAmount - paid;
    const status = leftover > 0 ? "LEFTOVER" : "PAID";

    await client.query(
      `UPDATE "PurchaseHdr" SET
        "PurchaseDate" = $1, "SupplierID" = $2, "Discount" = $3, "Tax" = $4, "TotalAmount" = $5,
        "Paid" = $6, "LeftOver" = $7, "Note" = $8, "Status" = $9, "UpdateUser" = $10, "UpdateDate" = now(),
        "BranchID" = $11
       WHERE "PurchaseID" = $12`,
      [purchaseDate, body.supplierId, discount, tax, totalAmount, paid, leftover,
        body.note || null, status, user, body.branchId, id]
    );

    for (const item of body.items) {
      const amount = Number(item.qty) * Number(item.price);
      await client.query(
        `INSERT INTO "PurchaseDtl"
          ("PurchaseHDRID","StockCode","Qty","Price","Amount","CreateUser","CreateDate","UpdateUser","UpdateDate")
         VALUES ($1,$2,$3,$4,$5,$6,now(),$6,now())`,
        [id, String(item.stockId), item.qty, item.price, amount, user]
      );
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" + $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [item.qty, item.stockId, body.branchId]
      );
    }

    if (paid !== 0) {
      await client.query(
        `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
         VALUES ($1,$2,$3,'PURCHASE',$4,now(),$5)`,
        [existing.PurchaseCode, purchaseDate, paid, user, body.branchId]
      );
    }

    await client.query("COMMIT");
    res.json({ purchaseId: Number(id), purchaseCode: existing.PurchaseCode, totalAmount, paid, leftover, status });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// Settles the leftover on an unpaid purchase (marks PAID, records a
// CREDITPAID payment) - matches the legacy PurchaseList "Paid" action.
async function markPaid(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const user = req.body.user || "web";
    await client.query("BEGIN");

    const purchaseRes = await client.query(`SELECT "PurchaseCode","LeftOver","Status","BranchID" FROM "PurchaseHdr" WHERE "PurchaseID" = $1`, [id]);
    if (purchaseRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Purchase not found" }); }
    const purchase = purchaseRes.rows[0];
    if (purchase.Status === "PAID") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This voucher already PAID, can not paid again!" });
    }

    await client.query(
      `UPDATE "PurchaseHdr" SET "Status" = 'PAID', "Paid" = "TotalAmount", "LeftOver" = 0 WHERE "PurchaseID" = $1`,
      [id]
    );
    await client.query(
      `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
       VALUES ($1, now(), $2, 'CREDITPAID', $3, now(), $4)`,
      [purchase.PurchaseCode, Math.abs(purchase.LeftOver), user, purchase.BranchID]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// Deletes a purchase entirely: reverses stock increases and removes the
// header/detail/payment rows - matches the legacy PurchaseList "Remove" action.
async function remove(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    const purchaseRes = await client.query(`SELECT "PurchaseCode","BranchID" FROM "PurchaseHdr" WHERE "PurchaseID" = $1`, [id]);
    if (purchaseRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Purchase not found" }); }
    const purchase = purchaseRes.rows[0];

    const detailRes = await client.query(`SELECT "StockCode","Qty" FROM "PurchaseDtl" WHERE "PurchaseHDRID" = $1`, [id]);
    for (const d of detailRes.rows) {
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" - $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [d.Qty, d.StockCode, purchase.BranchID]
      );
    }

    await client.query(`DELETE FROM "Payment" WHERE code = $1`, [purchase.PurchaseCode]);
    await client.query(`DELETE FROM "PurchaseDtl" WHERE "PurchaseHDRID" = $1`, [id]);
    await client.query(`DELETE FROM "PurchaseHdr" WHERE "PurchaseID" = $1`, [id]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, update, markPaid, remove };
