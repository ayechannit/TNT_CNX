const pool = require("../db/pool");
const { parsePagination } = require("../lib/pagination");

async function list(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || "").trim();
    const { branchId, fromDate, toDate } = req.query;

    const where = [`e.status <> 'delete'`];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(et.expensetype ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
    }
    if (branchId) {
      params.push(branchId);
      where.push(`e.branchid = $${params.length}`);
    }
    if (fromDate) {
      params.push(fromDate);
      where.push(`e.expensedate::date >= $${params.length}`);
    }
    if (toDate) {
      params.push(toDate);
      where.push(`e.expensedate::date <= $${params.length}`);
    }

    const whereSql = where.join(" AND ");
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "Expense" e JOIN "ExpenseType" et ON e.expensetypeid = et.expensetypeid WHERE ${whereSql}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT e.expenseid, e.expensetypeid, e.expensedate, e.description, e.amount, e.branchid,
              et.expensetype, b.branchname, e.createuser
       FROM "Expense" e
       JOIN "ExpenseType" et ON e.expensetypeid = et.expensetypeid
       LEFT JOIN "Branch" b ON e.branchid = b.id
       WHERE ${whereSql}
       ORDER BY e.expensedate DESC, e.expenseid DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    res.json({ data: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 });
  } catch (err) {
    next(err);
  }
}

function validate(body) {
  const errors = [];
  if (!body.expensetypeid) errors.push("Expense Type is required");
  if (!body.branchid) errors.push("Branch is required");
  if (!body.expensedate) errors.push("Date is required");
  if (!body.description || !body.description.trim()) errors.push("Description is required");
  if (body.amount === undefined || body.amount === "" || Number(body.amount) <= 0) errors.push("Amount is required");
  return errors;
}

async function create(req, res, next) {
  try {
    const body = req.body;
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ errors });

    const now = new Date().toISOString();
    const { rows } = await pool.query(
      `INSERT INTO "Expense"
        (expensetypeid, expensedate, description, amount, status, createuser, createdate, updateuser, updatedate, branchid, "LastModifiedDate")
       VALUES ($1,$2,$3,$4,'active',$5,$6,$5,$6,$7,$6)
       RETURNING expenseid`,
      [body.expensetypeid, body.expensedate, body.description.trim(), body.amount, body.user || "web", now, body.branchid]
    );
    res.status(201).json({ expenseid: rows[0].expenseid });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = req.params.id;
    const body = req.body;
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ errors });

    const now = new Date().toISOString();
    const { rowCount } = await pool.query(
      `UPDATE "Expense" SET
        expensetypeid = $1, expensedate = $2, description = $3, amount = $4,
        updateuser = $5, updatedate = $6, branchid = $7, "LastModifiedDate" = $6
       WHERE expenseid = $8 AND status <> 'delete'`,
      [body.expensetypeid, body.expensedate, body.description.trim(), body.amount, body.user || "web", now, body.branchid, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE "Expense" SET status = 'delete' WHERE expenseid = $1`,
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
