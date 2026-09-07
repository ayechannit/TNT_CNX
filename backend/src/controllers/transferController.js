const pool = require("../db/pool");
const { parsePagination } = require("../lib/pagination");

// Replicates Gen_NewTransferId: BranchNo + "_T" + YYYYMMDD + 4-digit sequence.
async function generateTransferCode(client, branchId, date) {
  const branchRes = await client.query(`SELECT branchno FROM "Branch" WHERE id = $1`, [branchId]);
  const branchNo = branchRes.rows[0]?.branchno || "BR";

  await client.query(
    `INSERT INTO "TransferNumberGenerator" ("CreatedDate", branchid) VALUES ($1, $2)`,
    [date, branchId]
  );
  const seqRes = await client.query(
    `SELECT COUNT(*) FROM "TransferNumberGenerator" WHERE branchid = $1 AND "CreatedDate" = $2`,
    [branchId, date]
  );
  const seq = parseInt(seqRes.rows[0].count, 10);
  const yyyymmdd = date.replace(/-/g, "");
  const seqPadded = String(seq).padStart(4, "0").slice(-4);
  return `${branchNo}_T${yyyymmdd}${seqPadded}`;
}

// view=out: transfers sent FROM branchId. view=in: transfers received AT branchId.
async function list(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || "").trim();
    const view = req.query.view || "out";
    const branchId = req.query.branchId;
    const params = [];
    let where = "1=1";
    if (branchId) {
      params.push(branchId);
      where += view === "in" ? ` AND h."ToBranchID" = $${params.length}` : ` AND h."FromBranchID" = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      where += ` AND h."TransferStatus" = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND h."TransferCode" ILIKE $${params.length}`;
    }
    if (req.query.fromDate) {
      params.push(req.query.fromDate);
      where += ` AND h."TransferDate"::date >= $${params.length}`;
    }
    if (req.query.toDate) {
      params.push(req.query.toDate);
      where += ` AND h."TransferDate"::date <= $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM "TransferHdr" h WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT h."TransferID", h."TransferCode", h."TransferDate", h."FromBranchID", h."ToBranchID",
              h."TransferStatus", h."TransferBy", h."Remark", h."TotalAmount",
              fb."branchname" AS "FromBranchName", tb."branchname" AS "ToBranchName"
       FROM "TransferHdr" h
       LEFT JOIN "Branch" fb ON fb.id = h."FromBranchID"
       LEFT JOIN "Branch" tb ON tb.id = h."ToBranchID"
       WHERE ${where}
       ORDER BY h."TransferID" DESC
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
      `SELECT h.*, fb."branchname" AS "FromBranchName", tb."branchname" AS "ToBranchName"
       FROM "TransferHdr" h
       LEFT JOIN "Branch" fb ON fb.id = h."FromBranchID"
       LEFT JOIN "Branch" tb ON tb.id = h."ToBranchID"
       WHERE h."TransferID" = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    const detailRes = await pool.query(
      `SELECT d.*, s."StockName" FROM "TransferDtl" d
       LEFT JOIN "StockMaster" s ON s."StockID" = d."FK_StockCode"::int
       WHERE d."TransferHdrID" = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], items: detailRes.rows });
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const errors = [];
  if (!body.fromBranchId) errors.push("From Branch is required");
  if (!body.toBranchId) errors.push("To Branch is required");
  if (body.fromBranchId === body.toBranchId) errors.push("From and To branch must be different");
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

    const transferDate = body.transferDate || new Date().toISOString().slice(0, 10);
    const user = body.user || "web";
    const totalAmount = body.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.price), 0);

    const transferCode = await generateTransferCode(client, body.fromBranchId, transferDate);

    const hdrRes = await client.query(
      `INSERT INTO "TransferHdr"
        ("TransferCode","TransferDate","FromBranchID","ToBranchID","TransferStatus","TransferBy","Remark",
         "CreateUser","CreateDate","UpdateUser","UpdateDate","TotalAmount")
       VALUES ($1,$2,$3,$4,'Open',$5,$6,$7,now(),$7,now(),$8)
       RETURNING "TransferID"`,
      [transferCode, transferDate, body.fromBranchId, body.toBranchId, body.transferBy || "", body.remark || "", user, totalAmount]
    );
    const transferId = hdrRes.rows[0].TransferID;

    for (const item of body.items) {
      const total = Number(item.qty) * Number(item.price);
      await client.query(
        `INSERT INTO "TransferDtl"
          ("TransferHdrID","FK_StockCode","Price","Qty","Total","Status","CreateUser","UpdateUser")
         VALUES ($1,$2,$3,$4,$5,'open',$6,$6)`,
        [transferId, String(item.stockId), item.price, item.qty, total, user]
      );
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" - $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [item.qty, item.stockId, body.fromBranchId]
      );
    }

    await client.query(
      `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
       VALUES ($1,$2,$3,'TRANSFEROUT',$4,now(),$5)`,
      [transferCode, transferDate, totalAmount, user, body.fromBranchId]
    );

    await client.query("COMMIT");
    res.status(201).json({ transferId, transferCode, totalAmount });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// Confirms receipt at the destination branch: marks Done, credits the
// destination's StockBalance, and logs a TRANSFERIN payment.
async function receive(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const user = req.body.user || "web";
    await client.query("BEGIN");

    const hdrRes = await client.query(`SELECT "TransferCode","ToBranchID","TransferStatus" FROM "TransferHdr" WHERE "TransferID" = $1`, [id]);
    if (hdrRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Transfer not found" }); }
    const hdr = hdrRes.rows[0];
    if (hdr.TransferStatus === "Done") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This transfer has already been received." });
    }

    await client.query(`UPDATE "TransferHdr" SET "TransferStatus" = 'Done' WHERE "TransferID" = $1`, [id]);
    await client.query(`UPDATE "TransferDtl" SET "Status" = 'Done' WHERE "TransferHdrID" = $1`, [id]);

    const detailRes = await client.query(`SELECT "FK_StockCode","Qty","Total" FROM "TransferDtl" WHERE "TransferHdrID" = $1`, [id]);
    let totalAmount = 0;
    for (const d of detailRes.rows) {
      totalAmount += Number(d.Total);
      const balRes = await client.query(
        `SELECT "Qty" FROM "StockBalance" WHERE "StockID" = $1 AND "BranchID" = $2`,
        [d.FK_StockCode, hdr.ToBranchID]
      );
      if (balRes.rows.length > 0) {
        await client.query(
          `UPDATE "StockBalance" SET "Qty" = "Qty" + $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
          [d.Qty, d.FK_StockCode, hdr.ToBranchID]
        );
      } else {
        await client.query(
          `INSERT INTO "StockBalance" ("StockID","Qty","BranchID") VALUES ($1,$2,$3)`,
          [d.FK_StockCode, d.Qty, hdr.ToBranchID]
        );
      }
    }

    await client.query(
      `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
       VALUES ($1, now(), $2, 'TRANSFERIN', $3, now(), $4)`,
      [hdr.TransferCode, Math.abs(totalAmount), user, hdr.ToBranchID]
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

// Deletes an Open transfer: restores the source branch's StockBalance and
// removes header/detail/payment rows. Matches legacy TransferList "Remove".
async function remove(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    const hdrRes = await client.query(`SELECT "TransferCode","FromBranchID","TransferStatus" FROM "TransferHdr" WHERE "TransferID" = $1`, [id]);
    if (hdrRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Transfer not found" }); }
    const hdr = hdrRes.rows[0];

    const detailRes = await client.query(`SELECT "FK_StockCode","Qty" FROM "TransferDtl" WHERE "TransferHdrID" = $1`, [id]);
    for (const d of detailRes.rows) {
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" + $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [d.Qty, d.FK_StockCode, hdr.FromBranchID]
      );
    }

    await client.query(`DELETE FROM "Payment" WHERE code = $1`, [hdr.TransferCode]);
    await client.query(`DELETE FROM "TransferDtl" WHERE "TransferHdrID" = $1`, [id]);
    await client.query(`DELETE FROM "TransferHdr" WHERE "TransferID" = $1`, [id]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, receive, remove };
