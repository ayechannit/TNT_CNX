const pool = require("../db/pool");
const { parsePagination } = require("../lib/pagination");

// Replicates Gen_NewSaleId: BranchNo + "_S" + YYYYMMDD + 4-digit sequence,
// where the sequence is a running count of tracking rows in SaleNumberGenerator
// for that branch/date (same approach the legacy stored procedure uses).
async function generateSaleCode(client, branchId, date) {
  const branchRes = await client.query(`SELECT branchno FROM "Branch" WHERE id = $1`, [branchId]);
  const branchNo = branchRes.rows[0]?.branchno || "BR";

  await client.query(
    `INSERT INTO "SaleNumberGenerator" ("CreatedDate", "BranchId") VALUES ($1, $2)`,
    [date, branchId]
  );
  const seqRes = await client.query(
    `SELECT COUNT(*) FROM "SaleNumberGenerator" WHERE "BranchId" = $1 AND "CreatedDate" = $2`,
    [branchId, date]
  );
  const seq = parseInt(seqRes.rows[0].count, 10);
  const yyyymmdd = date.replace(/-/g, "");
  const seqPadded = String(seq).padStart(4, "0").slice(-4);
  return `${branchNo}_S${yyyymmdd}${seqPadded}`;
}

async function list(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || "").trim();
    const view = req.query.view || "all"; // all | paid | unpaid | order
    const params = [];
    let where = "1=1";
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (h."SaleCode" ILIKE $${params.length} OR p."PatientName" ILIKE $${params.length})`;
    }
    if (view === "paid") where += ` AND h."Status" = 'PAID'`;
    if (view === "unpaid") where += ` AND h."Status" = 'LEFTOVER'`;
    if (req.query.fromDate) {
      params.push(req.query.fromDate);
      where += ` AND h."SaleDate"::date >= $${params.length}`;
    }
    if (req.query.toDate) {
      params.push(req.query.toDate);
      where += ` AND h."SaleDate"::date <= $${params.length}`;
    }

    const opticJoin = view === "order"
      ? `INNER JOIN "OpticSale" os ON os.salehdrid = h."SaleID" AND os.status = 'deliver'`
      : `LEFT JOIN "OpticSale" os ON os.salehdrid = h."SaleID"`;

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM "SaleHdr" h
       LEFT JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
       ${opticJoin}
       WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT h."SaleID", h."SaleCode", h."SaleDate", h."PatientID", p."PatientName",
              h."Discount", h."Tax", h."TotalAmount", h."Paid", h."LeftOver", h."Status", h."BranchID",
              os.deliverydate, os.status AS optic_status
       FROM "SaleHdr" h
       LEFT JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
       ${opticJoin}
       WHERE ${where}
       ORDER BY h."SaleID" DESC
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
      `SELECT h.*, p."PatientName" FROM "SaleHdr" h
       LEFT JOIN "PatientMaster" p ON h."PatientID" = p."PatientID"
       WHERE h."SaleID" = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    const detailRes = await pool.query(
      `SELECT d.*, s."StockName", s."StockCode" AS "StockItemCode" FROM "SaleDtl" d
       LEFT JOIN "StockMaster" s ON s."StockID" = d."StockCode"::int
       WHERE d."SaleHDRID" = $1`,
      [req.params.id]
    );
    const opticRes = await pool.query(`SELECT * FROM "OpticSale" WHERE salehdrid = $1`, [req.params.id]);

    res.json({ ...rows[0], items: detailRes.rows, optic: opticRes.rows[0] || null });
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const errors = [];
  if (!body.patientId) errors.push("Customer is required");
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

    const saleDate = body.saleDate || new Date().toISOString().slice(0, 10);
    const user = body.user || "web";
    const discount = Number(body.discount) || 0;
    const tax = Number(body.tax) || 0;
    const itemsTotal = body.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.price), 0);
    const totalAmount = itemsTotal - discount + tax;
    const paid = Number(body.paid) || 0;
    const leftover = totalAmount - paid;
    const status = leftover > 0 ? "LEFTOVER" : "PAID";

    const saleCode = await generateSaleCode(client, body.branchId, saleDate);

    const hdrRes = await client.query(
      `INSERT INTO "SaleHdr"
        ("SaleCode","SaleDate","PatientID","Discount","Tax","TotalAmount","Paid","LeftOver","Note",
         "Status","CreateUser","CreateDate","UpdateUser","UpdateDate","BranchID")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$11,now(),$12)
       RETURNING "SaleID"`,
      [saleCode, saleDate, body.patientId, discount, tax, totalAmount, paid, leftover,
        body.note || null, status, user, body.branchId]
    );
    const saleId = hdrRes.rows[0].SaleID;

    if (body.optic) {
      const o = body.optic;
      await client.query(
        `INSERT INTO "OpticSale"
          (salehdrid, memberid, deliverydate, sphereod, sphereos, cylinderod, cylinderos,
           axisod, axisos, prismod, prismos, pdmm, status, createuser, updateuser, branchid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15)`,
        [saleId, o.memberid || null, o.deliverydate || null, o.sphereod || null, o.sphereos || null,
          o.cylinderod || null, o.cylinderos || null, o.axisod || null, o.axisos || null,
          o.prismod || null, o.prismos || null, o.pdmm || null,
          o.deliver ? "deliver" : "finish", user, body.branchId]
      );
    }

    for (const item of body.items) {
      const amount = Number(item.qty) * Number(item.price);
      await client.query(
        `INSERT INTO "SaleDtl"
          ("SaleHDRID","StockCode","Qty","Price","Amount","CreateUser","CreateDate","UpdateUser","UpdateDate")
         VALUES ($1,$2,$3,$4,$5,$6,now(),$6,now())`,
        [saleId, String(item.stockId), item.qty, item.price, amount, user]
      );
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" - $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [item.qty, item.stockId, body.branchId]
      );
      if (item.price > 0) {
        await client.query(`UPDATE "StockMaster" SET sellprice = $1 WHERE "StockID" = $2`, [item.price, item.stockId]);
      }
    }

    if (paid !== 0) {
      await client.query(
        `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
         VALUES ($1,$2,$3,'SALE',$4,now(),$5)`,
        [saleCode, saleDate, paid, user, body.branchId]
      );
    }
    if (leftover > 0) {
      await client.query(
        `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
         VALUES ($1,$2,$3,'SALEDEBIT',$4,now(),$5)`,
        [saleCode, saleDate, leftover, user, body.branchId]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ saleId, saleCode, totalAmount, paid, leftover, status });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// Settles the leftover on an unpaid (LEFTOVER) sale: marks it PAID and
// records the settlement as a DEBITPAID payment, matching the legacy
// SaleList "Paid" action exactly.
async function markPaid(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const user = req.body.user || "web";
    await client.query("BEGIN");

    const saleRes = await client.query(`SELECT "SaleCode","LeftOver","TotalAmount","Status","BranchID" FROM "SaleHdr" WHERE "SaleID" = $1`, [id]);
    if (saleRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Sale not found" }); }
    const sale = saleRes.rows[0];
    if (sale.Status !== "LEFTOVER") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This sale is not marked Unpaid." });
    }

    await client.query(
      `UPDATE "SaleHdr" SET "Status" = 'PAID', "Paid" = "TotalAmount", "LeftOver" = 0 WHERE "SaleID" = $1`,
      [id]
    );
    await client.query(
      `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
       VALUES ($1, now(), $2, 'DEBITPAID', $3, now(), $4)`,
      [sale.SaleCode, Math.abs(sale.LeftOver), user, sale.BranchID]
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

// Reverses a markPaid settlement - only possible if it was actually settled
// that way (a DEBITPAID payment row exists for this sale's code).
async function undoPaid(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    const saleRes = await client.query(`SELECT "SaleCode","TotalAmount" FROM "SaleHdr" WHERE "SaleID" = $1`, [id]);
    if (saleRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Sale not found" }); }
    const sale = saleRes.rows[0];

    const debitRes = await client.query(
      `SELECT paidamount FROM "Payment" WHERE code = $1 AND tablename = 'DEBITPAID'`,
      [sale.SaleCode]
    );
    if (debitRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This voucher cannot be unpaid because it was fully paid in one transaction." });
    }
    const leftover = debitRes.rows[0].paidamount;

    await client.query(
      `UPDATE "SaleHdr" SET "Status" = 'LEFTOVER', "Paid" = "TotalAmount" - $1, "LeftOver" = $1 WHERE "SaleID" = $2`,
      [leftover, id]
    );
    await client.query(`DELETE FROM "Payment" WHERE code = $1 AND tablename = 'DEBITPAID'`, [sale.SaleCode]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

async function markDelivered(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE "OpticSale" SET status = 'finish' WHERE salehdrid = $1`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "No optic order found for this sale" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Deletes a sale entirely: restores stock balances, decrements sale counts,
// and removes the header/detail/optic/payment rows - matching the legacy
// SaleList "Remove" action.
async function remove(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");

    const saleRes = await client.query(`SELECT "SaleCode","BranchID" FROM "SaleHdr" WHERE "SaleID" = $1`, [id]);
    if (saleRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Sale not found" }); }
    const sale = saleRes.rows[0];

    const detailRes = await client.query(`SELECT "StockCode","Qty" FROM "SaleDtl" WHERE "SaleHDRID" = $1`, [id]);
    for (const d of detailRes.rows) {
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" + $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [d.Qty, d.StockCode, sale.BranchID]
      );
      await client.query(`UPDATE "StockMaster" SET "SaleCount" = "SaleCount" - $1 WHERE "StockID" = $2`, [d.Qty, d.StockCode]);
    }

    await client.query(`DELETE FROM "Payment" WHERE code = $1`, [sale.SaleCode]);
    await client.query(`DELETE FROM "SaleDtl" WHERE "SaleHDRID" = $1`, [id]);
    await client.query(`DELETE FROM "OpticSale" WHERE salehdrid = $1`, [id]);
    await client.query(`DELETE FROM "SaleHdr" WHERE "SaleID" = $1`, [id]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// Edits an existing sale: reverses the old line items' effect on stock,
// replaces the header/detail/optic/payment rows with the new values, and
// re-applies the stock effect for the new items. Keeps the same SaleID and
// SaleCode - only the contents change.
async function update(req, res, next) {
  const body = req.body;
  const errors = validate(body);
  if (errors.length) return res.status(400).json({ errors });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;

    const existingRes = await client.query(`SELECT "SaleCode","BranchID" FROM "SaleHdr" WHERE "SaleID" = $1`, [id]);
    if (existingRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Sale not found" }); }
    const existing = existingRes.rows[0];

    const oldItemsRes = await client.query(`SELECT "StockCode","Qty" FROM "SaleDtl" WHERE "SaleHDRID" = $1`, [id]);
    for (const d of oldItemsRes.rows) {
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" + $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [d.Qty, d.StockCode, existing.BranchID]
      );
      await client.query(`UPDATE "StockMaster" SET "SaleCount" = "SaleCount" - $1 WHERE "StockID" = $2`, [d.Qty, d.StockCode]);
    }

    await client.query(`DELETE FROM "SaleDtl" WHERE "SaleHDRID" = $1`, [id]);
    await client.query(`DELETE FROM "OpticSale" WHERE salehdrid = $1`, [id]);
    await client.query(`DELETE FROM "Payment" WHERE code = $1`, [existing.SaleCode]);

    const saleDate = body.saleDate || new Date().toISOString().slice(0, 10);
    const user = body.user || "web";
    const discount = Number(body.discount) || 0;
    const tax = Number(body.tax) || 0;
    const itemsTotal = body.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.price), 0);
    const totalAmount = itemsTotal - discount + tax;
    const paid = Number(body.paid) || 0;
    const leftover = totalAmount - paid;
    const status = leftover > 0 ? "LEFTOVER" : "PAID";

    await client.query(
      `UPDATE "SaleHdr" SET
        "SaleDate" = $1, "PatientID" = $2, "Discount" = $3, "Tax" = $4, "TotalAmount" = $5,
        "Paid" = $6, "LeftOver" = $7, "Note" = $8, "Status" = $9, "UpdateUser" = $10, "UpdateDate" = now(),
        "BranchID" = $11
       WHERE "SaleID" = $12`,
      [saleDate, body.patientId, discount, tax, totalAmount, paid, leftover,
        body.note || null, status, user, body.branchId, id]
    );

    if (body.optic) {
      const o = body.optic;
      await client.query(
        `INSERT INTO "OpticSale"
          (salehdrid, memberid, deliverydate, sphereod, sphereos, cylinderod, cylinderos,
           axisod, axisos, prismod, prismos, pdmm, status, createuser, updateuser, branchid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15)`,
        [id, o.memberid || null, o.deliverydate || null, o.sphereod || null, o.sphereos || null,
          o.cylinderod || null, o.cylinderos || null, o.axisod || null, o.axisos || null,
          o.prismod || null, o.prismos || null, o.pdmm || null,
          o.deliver ? "deliver" : "finish", user, body.branchId]
      );
    }

    for (const item of body.items) {
      const amount = Number(item.qty) * Number(item.price);
      await client.query(
        `INSERT INTO "SaleDtl"
          ("SaleHDRID","StockCode","Qty","Price","Amount","CreateUser","CreateDate","UpdateUser","UpdateDate")
         VALUES ($1,$2,$3,$4,$5,$6,now(),$6,now())`,
        [id, String(item.stockId), item.qty, item.price, amount, user]
      );
      await client.query(
        `UPDATE "StockBalance" SET "Qty" = "Qty" - $1 WHERE "StockID" = $2 AND "BranchID" = $3`,
        [item.qty, item.stockId, body.branchId]
      );
      if (item.price > 0) {
        await client.query(`UPDATE "StockMaster" SET sellprice = $1 WHERE "StockID" = $2`, [item.price, item.stockId]);
      }
    }

    if (paid !== 0) {
      await client.query(
        `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
         VALUES ($1,$2,$3,'SALE',$4,now(),$5)`,
        [existing.SaleCode, saleDate, paid, user, body.branchId]
      );
    }
    if (leftover > 0) {
      await client.query(
        `INSERT INTO "Payment" (code, paymentdate, paidamount, tablename, createuser, createdate, branchid)
         VALUES ($1,$2,$3,'SALEDEBIT',$4,now(),$5)`,
        [existing.SaleCode, saleDate, leftover, user, body.branchId]
      );
    }

    await client.query("COMMIT");
    res.json({ saleId: Number(id), saleCode: existing.SaleCode, totalAmount, paid, leftover, status });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { list, getById, create, update, markPaid, undoPaid, markDelivered, remove };
