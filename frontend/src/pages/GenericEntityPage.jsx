import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import PaginationBar from "../components/PaginationBar";
import SearchableSelect from "../components/SearchableSelect";
import SearchBox from "../components/SearchBox";
import PasswordInput from "../components/PasswordInput";
import "./StockPage.css";

/**
 * Generic list + create/edit form for simple master-data tables
 * (Category, Supplier, Branch, Expense Type, Users). Customer has its own
 * page since it needs custom Member/memberID logic.
 *
 * config:
 *   entityPath: API path segment, e.g. "categories"
 *   idField: primary key field name, e.g. "CategoryID"
 *   title: page heading
 *   columns: [{ key, label }] shown in the list table
 *   fields: [{ key, label, type }] shown in the form (type: text | number | select)
 *     select fields need `options: [{value,label}]` or `optionsKey` to look up from state
 */
export default function GenericEntityPage({ entityPath, idField, title, columns, fields }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({});
  const [mode, setMode] = useState("view");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await api.listEntity(entityPath, { q: search, page, pageSize });
      setItems(result.data);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, pageSize, entityPath]);

  useEffect(() => {
    setPage(1);
    setForm({});
    setMode("view");
    setError("");
  }, [entityPath]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  function startNew() {
    setForm({});
    setMode("add");
    setError("");
  }

  function selectRow(row) {
    if (mode !== "view") return;
    setForm({ ...row });
  }

  function startEdit() {
    if (form[idField] === undefined) return;
    setMode("edit");
    setError("");
  }

  function cancel() {
    setForm({});
    setMode("view");
    setError("");
  }

  async function save() {
    setError("");
    try {
      if (mode === "add") {
        await api.createEntity(entityPath, form);
      } else if (mode === "edit") {
        await api.updateEntity(entityPath, form[idField], form);
      }
      setForm({});
      setMode("view");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const readOnly = mode === "view";

  return (
    <div className="stock-page">
      <div className="stock-list">
        <div className="filter-row">
          <SearchBox
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={setSearch}
          />
        </div>
        <table>
          <thead>
            <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row[idField]}
                className={form[idField] === row[idField] ? "selected" : ""}
                onClick={() => selectRow(row)}
              >
                {columns.map((c) => <td key={c.key}>{String(row[c.key] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="muted">Loading...</div>}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <div className="stock-form">
        <div className="button-row">
          <button className="btn-secondary" onClick={startNew} disabled={mode !== "view"}>New</button>
          <button className="btn-secondary" onClick={startEdit} disabled={mode !== "view" || form[idField] === undefined}>Edit</button>
          <button className="btn-primary" onClick={save} disabled={mode === "view"}>Save</button>
          <button className="btn-secondary" onClick={cancel} disabled={mode === "view"}>Cancel</button>
        </div>

        {error && <div className="error">{error}</div>}

        {fields.map((f) => (
          <React.Fragment key={f.key}>
            <label>{f.label}</label>
            {f.type === "select" ? (
              <SearchableSelect
                isDisabled={readOnly}
                value={form[f.key] ?? ""}
                onChange={(v) => setForm({ ...form, [f.key]: v })}
                options={f.options || []}
              />
            ) : f.type === "password" ? (
              <PasswordInput
                disabled={readOnly}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <input
                disabled={readOnly}
                type={f.type || "text"}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
