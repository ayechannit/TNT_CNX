const pool = require("../db/pool");
const { parsePagination } = require("../lib/pagination");

// Replicates Gen_NewReturnId: BranchNo + "_R" + YYYYMMDD + 4-digit sequence.
async function generateReturnCode(client, branchId, date) {
  const branchRes = await client.query(`SELECT branchno FROM "Branch" WHERE id = $1`, [branchId]);
  const branchNo = branchRes.rows[0]?.branchno || "BR";

  await client.query(
    `INSERT INTO "ReturnNumberGenerator" ("CreatedDate", "BranchId") VALUES ($1, $2)`,
    [date, branchId]
  );
  const seqRes = await client.query(
    `SELECT COUNT(*) FROM "ReturnNumberGenerator" WHERE "BranchId" = $1 AND "CreatedDate" = $2`,
    [branchId, date]
  );
  const seq = parseInt(seqRes.rows[0].count, 10);
  const yyyymmdd = date.replace(/-/g, "");
  const seqPadded = String(seq).padStart(4, "0").slice(-4);
  return `${branchNo}_R${yyyymmdd}${seqPadded}`;
}

// Purchase Return / Damage list. Type: RETURN | DAMAGE. DAMAGE hardcodes
// SupplierID = 2 and is always fully paid (matches legacy Return.cs).
async function list(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || "").trim();
    const type = req.query.type || ""; // RETURN | DAMAGE
    const params = [];
    let where = "1=1";
    if (type) {
      params.push(type);
      where += ` AND h."Type" = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (h."ReturnCode" ILIKE $${params.length} OR s."SupplierName" ILIKE $${params.length})`;
    }
    if (req.query.fromDate) {
      params.push(req.query.fromDate);
      where += ` AND h."Date"::date >= $${params.length}`;
    }
    if (req.query.toDate) {
      params.push(req.query.toDate);
      where += ` AND h."Date"::date <= $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM "ReturnHdr" h
       LEFT JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
       WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT h."ReturnID", h."ReturnCode", h."Date", h."Type", h."SupplierID", s."SupplierName",
              h."TotalAmount", h."Paid", h."LeftOver", h."Status", h."BranchID"
       FROM "ReturnHdr" h
       LEFT JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
       WHERE ${where}
       ORDER BY h."ReturnID" DESC
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
      `SELECT h.*, s."SupplierName" FROM "ReturnHdr" h
       LEFT JOIN "SupplierMaster" s ON h."SupplierID" = s."SupplierID"
       WHERE h."ReturnID" = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    const detailRes = await pool.query(
      `SELECT d.*, st."StockName" FROM "ReturnDtl" d
       LEFT JOIN "StockMaster" st ON st."StockID" = d."StockCode"::int
       WHERE d."ReturnHDRID" = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], items: detailRes.rows });
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const errors = [];
  if (!body.type || !["RETURN", "DAMAGE"].includes(body.type)) errors.push("Type must be RETURN or DAMAGE");
  if (body.type === "RETURN" && !body.supplierId) errors.push("Supplier is required");
  if (!body.branchId) errors.push("Branch is required");
  if (!Array.isArray(body.items) || body.items.length === 0) errors.push("At least one item is required");
  return errors;
}

// Both RETURN and DAMAGE decrement stock. DAMAGE is always fully paid
// (tablename DAMAGE, hardcoded SupplierID = 2); RETURN allows Paid/LeftOver
// split (tablename RETURN) - matches legacy Return.cs exactly.
async function create(req, res, next) {
  const body = req.body;
  const errors = validate(body);
  if (errors.length) return res.status(400).json({ errors });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const date = body.date || new Date().toISOString().slice(0, 10);
    const user = body.user || "web";
    const isDamage = body.type === "DAMAGE";
    const supplierId = isDamage ? 2 : body.supplierId;
    const totalAmount = body.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.price), 0);
    const paid = isDamage ? totalAmount : (Number(body.paid) || 0);
    const leftover = totalAmount - paid;
    const status = leftover > 0 ? "LEFTOVER" : "PAID";
    const tablename = isDamage ? "DAMAGE" : "RETURN";

    const returnCode = await generateReturnCode(client, body.branchId, date);

    const hdrRes = await client.query(
      `INSERT INTO "ReturnHdr"
        ("ReturnCode","Date","Type","SupplierID","TotalAmount","Paid","LeftOver","Note",
         "Status","CreateUser","CreateDate","UpdateUser","UpdateDate","BranchID")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$10,now(),$11)
       RETURNING "ReturnID"`,
      [returnCode, date, body.type, supplierId, totalAmount, paid, leftover,
        body.note || null, status, user, body.branchId]
    );
    const returnId = hdrRes.rows[0].ReturnID;

    for (const item of body.items) {
      const amount = Number(item.qty) * Number(item.price);
      await client.query(
        `INSERT INTO "ReturnDtl"
          ("ReturnHDRID","StockCode","Qty","Price","Amount","CreateUser","CreateDate","UpdateUser","UpdateDate")
         VALUES ($1,$2,$3,$4,$5,$6,now(),$6,now())`,
        [returnId, String(item.stockId), item.qty, item.price, amount, user]
      );
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" - $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [item.qty, item.stockId, body.branchId]
      );
    }

    if (paid !== 0) {
      await client.query(
        `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
         VALUES ($1,$2,$3,$4,$5,now(),$6)`,
        [returnCode, date, paid, tablename, user, body.branchId]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ returnId, returnCode, totalAmount, paid, leftover, status });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// Deletes a return/damage entirely: reverses the stock decrease and removes
// the header/detail/payment rows. No edit exists in the legacy app.
async function remove(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    const returnRes = await client.query(`SELECT "ReturnCode","BranchID" FROM "ReturnHdr" WHERE "ReturnID" = $1`, [id]);
    if (returnRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Return not found" }); }
    const ret = returnRes.rows[0];

    const detailRes = await client.query(`SELECT "StockCode","Qty" FROM "ReturnDtl" WHERE "ReturnHDRID" = $1`, [id]);
    for (const d of detailRes.rows) {
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" + $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [d.Qty, d.StockCode, ret.BranchID]
      );
    }

    await client.query(`DELETE FROM "Payment" WHERE code = $1`, [ret.ReturnCode]);
    await client.query(`DELETE FROM "ReturnDtl" WHERE "ReturnHDRID" = $1`, [id]);
    await client.query(`DELETE FROM "ReturnHdr" WHERE "ReturnID" = $1`, [id]);

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
