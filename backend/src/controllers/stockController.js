const pool = require("../db/pool");
const { parsePagination } = require("../lib/pagination");

async function search(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || "").trim();
    const { categoryId, status, stockType } = req.query;

    const where = ["1=1"];
    const params = [];

    if (q) {
      params.push(`%${q}%`, q);
      where.push(`(s."StockName" ILIKE $${params.length - 1} OR s."StockCode" ILIKE $${params.length - 1} OR s."Barcode" = $${params.length})`);
    } else {
      where.push(`s.status <> 'delete'`);
    }
    if (categoryId) {
      params.push(categoryId);
      where.push(`s."CategoryID" = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`s.status = $${params.length}`);
    }
    if (stockType) {
      params.push(stockType);
      where.push(`s."StockType" = $${params.length}`);
    }

    const whereSql = where.join(" AND ");
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "StockMaster" s WHERE ${whereSql}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT s."StockID", s."StockCode", s."StockName", s."CategoryID", c."CategoryName",
              s."StockType", s."Reorderlevel", s."sellprice", s."status", s."Barcode"
       FROM "StockMaster" s
       JOIN "CategoryMaster" c ON s."CategoryID" = c."CategoryID"
       WHERE ${whereSql}
       ORDER BY s."StockName"
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    res.json({ data: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 });
  } catch (err) {
    next(err);
  }
}

async function getByBarcode(req, res, next) {
  try {
    const { barcode } = req.params;
    const { rows } = await pool.query(
      `SELECT "StockID", "StockCode", "StockName", "CategoryID", "StockType",
              "Reorderlevel", "sellprice", "status", "Barcode"
       FROM "StockMaster"
       WHERE "Barcode" = $1 AND status <> 'delete'`,
      [barcode]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "No item found for this barcode" });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT "StockID", "StockCode", "StockName", "CategoryID", "StockType",
              "Reorderlevel", "sellprice", "status", "Barcode"
       FROM "StockMaster" WHERE "StockID" = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const errors = [];
  if (!body.CategoryID) errors.push("Category is required");
  if (!body.StockCode || !body.StockCode.trim()) errors.push("Stock Code is required");
  if (!body.StockName || !body.StockName.trim()) errors.push("Stock Name is required");
  if (body.Reorderlevel === undefined || body.Reorderlevel === "") errors.push("Reorder Level is required");
  if (body.sellprice === undefined || body.sellprice === "") errors.push("Sell Price is required");
  return errors;
}

async function checkDuplicate(field, value, excludeId) {
  if (!value) return false;
  const params = [value];
  let sql = `SELECT 1 FROM "StockMaster" WHERE "${field}" = $1`;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND "StockID" <> $2`;
  }
  const { rows } = await pool.query(sql, params);
  return rows.length > 0;
}

async function create(req, res, next) {
  try {
    const body = req.body;
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ errors });

    if (await checkDuplicate("StockCode", body.StockCode.trim())) {
      return res.status(400).json({ errors: ["Stock Code already exists"] });
    }
    if (body.Barcode && (await checkDuplicate("Barcode", body.Barcode.trim()))) {
      return res.status(400).json({ errors: ["This barcode is already used by another item"] });
    }

    const { rows } = await pool.query(
      `INSERT INTO "StockMaster"
        ("CategoryID","StockCode","StockName","StockType","Reorderlevel","sellprice",
         "SaleCount","status","Barcode","CreateUser","CreateDate","UpdateUser","UpdateDate")
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,now(),$9,now())
       RETURNING "StockID"`,
      [
        body.CategoryID,
        body.StockCode.trim(),
        body.StockName.trim(),
        body.StockType || "countable",
        body.Reorderlevel,
        body.sellprice,
        body.status || "active",
        body.Barcode ? body.Barcode.trim() : null,
        body.user || "web",
      ]
    );
    res.status(201).json({ StockID: rows[0].StockID });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ errors: ["This barcode is already used by another item"] });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = req.params.id;
    const body = req.body;
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ errors });

    if (await checkDuplicate("StockCode", body.StockCode.trim(), id)) {
      return res.status(400).json({ errors: ["Stock Code already exists"] });
    }
    if (body.Barcode && (await checkDuplicate("Barcode", body.Barcode.trim(), id))) {
      return res.status(400).json({ errors: ["This barcode is already used by another item"] });
    }

    const { rowCount } = await pool.query(
      `UPDATE "StockMaster" SET
        "CategoryID" = $1, "StockCode" = $2, "StockName" = $3, "StockType" = $4,
        "Reorderlevel" = $5, "sellprice" = $6, "status" = $7, "Barcode" = $8,
        "UpdateUser" = $9, "UpdateDate" = now()
       WHERE "StockID" = $10`,
      [
        body.CategoryID,
        body.StockCode.trim(),
        body.StockName.trim(),
        body.StockType || "countable",
        body.Reorderlevel,
        body.sellprice,
        body.status || "active",
        body.Barcode ? body.Barcode.trim() : null,
        body.user || "web",
        id,
      ]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ errors: ["This barcode is already used by another item"] });
    }
    next(err);
  }
}

module.exports = { search, getByBarcode, getById, create, update };
