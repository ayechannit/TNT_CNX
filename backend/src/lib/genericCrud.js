const express = require("express");
const pool = require("../db/pool");
const { parsePagination } = require("./pagination");

/**
 * Builds a CRUD router for a simple master-data table.
 *
 * config:
 *   table: quoted table name, e.g. '"CategoryMaster"'
 *   idColumn: primary key column name, e.g. "CategoryID"
 *   columns: array of writable column names (excludes idColumn/audit columns)
 *   searchColumns: columns matched with ILIKE when ?q= is passed
 *   filterColumns: columns matched with exact equality when passed as query params
 *   defaultSort: ORDER BY clause (column name)
 *   auditColumns: { createUser, createDate, updateUser, updateDate } - exact column names to stamp,
 *     if this table has them (naming is inconsistent across this legacy schema - omit if the
 *     table has no audit columns at all).
 */
function createCrudRouter(config) {
  const { table, idColumn, columns, searchColumns = [], filterColumns = [], defaultSort, auditColumns } = config;
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const { page, pageSize, offset } = parsePagination(req.query);
      const q = (req.query.q || "").trim();
      const where = [];
      const params = [];

      if (q && searchColumns.length) {
        params.push(`%${q}%`);
        where.push("(" + searchColumns.map((c) => `"${c}" ILIKE $${params.length}`).join(" OR ") + ")");
      }
      for (const col of filterColumns) {
        if (req.query[col] !== undefined && req.query[col] !== "") {
          params.push(req.query[col]);
          where.push(`"${col}" = $${params.length}`);
        }
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const countResult = await pool.query(`SELECT COUNT(*) FROM ${table} ${whereSql}`, params);
      const total = parseInt(countResult.rows[0].count, 10);

      const dataParams = [...params, pageSize, offset];
      const { rows } = await pool.query(
        `SELECT * FROM ${table} ${whereSql} ORDER BY "${defaultSort}" LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      res.json({ data: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM ${table} WHERE "${idColumn}" = $1`, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const body = req.body;
      const cols = [...columns];
      const values = columns.map((c) => (body[c] === undefined ? null : body[c]));
      if (auditColumns) {
        const now = new Date().toISOString();
        cols.push(auditColumns.createUser, auditColumns.createDate, auditColumns.updateUser, auditColumns.updateDate);
        values.push(body.user || "web", now, body.user || "web", now);
      }
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const { rows } = await pool.query(
        `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) RETURNING "${idColumn}"`,
        values
      );
      res.status(201).json({ [idColumn]: rows[0][idColumn] });
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const body = req.body;
      const cols = [...columns];
      const values = columns.map((c) => (body[c] === undefined ? null : body[c]));
      if (auditColumns) {
        cols.push(auditColumns.updateUser, auditColumns.updateDate);
        values.push(body.user || "web", new Date().toISOString());
      }
      const setClause = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
      values.push(req.params.id);
      const { rowCount } = await pool.query(
        `UPDATE ${table} SET ${setClause} WHERE "${idColumn}" = $${values.length}`,
        values
      );
      if (rowCount === 0) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE "${idColumn}" = $1`, [req.params.id]);
      if (rowCount === 0) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createCrudRouter };
