import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import SearchableSelect from "../components/SearchableSelect";
import "./StockPage.css";
import "./UserRolePage.css";
import "./SalePage.css";
import "./ReportsPage.css";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [category, setCategory] = useState("");
  const [reportKey, setReportKey] = useState("");
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [params, setParams] = useState({});
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listReports().then((data) => {
      setReports(data);
      if (data.length > 0) {
        setCategory(data[0].category);
        setReportKey(data[0].key);
      }
    }).catch((e) => setError(e.message));
    api.listEntity("branches", { pageSize: 1000 }).then((r) => setBranches(r.data)).catch(() => {});
    api.listEntity("suppliers", { pageSize: 1000 }).then((r) => setSuppliers(r.data)).catch(() => {});
    api.getCategories().then((data) => setCategories(data)).catch(() => {});
  }, []);

  const categoryList = useMemo(() => [...new Set(reports.map((r) => r.category))], [reports]);
  const reportsInCategory = useMemo(() => reports.filter((r) => r.category === category), [reports, category]);
  const activeReport = useMemo(() => reports.find((r) => r.key === reportKey), [reports, reportKey]);

  useEffect(() => {
    if (!activeReport) return;
    const defaults = {};
    activeReport.params.forEach((p) => {
      if (p.type === "date" && p.name.toLowerCase().includes("from")) defaults[p.name] = monthStartStr();
      else if (p.type === "date") defaults[p.name] = todayStr();
      else if (p.type === "branch" && branches.length > 0) defaults[p.name] = branches[0].id;
      else defaults[p.name] = "";
    });
    setParams(defaults);
    setRows(null);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey, branches.length]);

  function setParam(name, value) {
    setParams((prev) => ({ ...prev, [name]: value }));
  }

  async function runReport() {
    setError("");
    setLoading(true);
    try {
      for (const p of activeReport.params) {
        if (p.required && !params[p.name] && params[p.name] !== 0) {
          throw new Error(`${paramLabel(p.name)} is required`);
        }
      }
      const data = await api.runReport(activeReport.key, params);
      setRows(data);
    } catch (err) {
      setError(err.message);
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  function paramLabel(name) {
    return name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
  }

  function exportCsv() {
    if (!rows || rows.length === 0) return;
    const columns = Object.keys(rows[0]);
    const escape = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [columns.join(","), ...rows.map((r) => columns.map((c) => escape(r[c])).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReport.key}_${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderParamInput(p) {
    const value = params[p.name] ?? "";
    if (p.type === "date") {
      return <input className="reports-input" type="date" value={value} onChange={(e) => setParam(p.name, e.target.value)} />;
    }
    if (p.type === "branch") {
      return (
        <SearchableSelect
          value={value}
          onChange={(v) => setParam(p.name, v)}
          options={branches.map((b) => ({ value: b.id, label: b.branchname }))}
          isClearable={!p.required}
        />
      );
    }
    if (p.type === "supplier") {
      return (
        <SearchableSelect
          value={value}
          onChange={(v) => setParam(p.name, v)}
          options={suppliers.map((s) => ({ value: s.SupplierID, label: s.SupplierName }))}
          placeholder="All suppliers"
        />
      );
    }
    if (p.type === "category") {
      return (
        <SearchableSelect
          value={value}
          onChange={(v) => setParam(p.name, v)}
          options={categories.map((c) => ({ value: c.CategoryID, label: c.CategoryName }))}
          placeholder="All categories"
        />
      );
    }
    if (p.type === "select") {
      return (
        <select className="reports-select" value={value} onChange={(e) => setParam(p.name, e.target.value)}>
          {!p.required && <option value="">All</option>}
          {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (p.type === "stock") {
      return <input className="reports-input" type="number" placeholder="Stock ID" value={value} onChange={(e) => setParam(p.name, e.target.value)} />;
    }
    return <input className="reports-input" value={value} onChange={(e) => setParam(p.name, e.target.value)} />;
  }

  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="sale-page reports-page">
      <div className="reports-layout">
        <div className="reports-sidebar">
          <h3>Categories</h3>
          {categoryList.map((c) => (
            <button
              key={c}
              className={`reports-category-btn ${c === category ? "active" : ""}`}
              onClick={() => { setCategory(c); const first = reports.find((r) => r.category === c); if (first) setReportKey(first.key); }}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="reports-main">
          <div className="reports-controls">
            <div className="reports-picker">
              <label className="reports-picker-label">Report</label>
              <SearchableSelect
                value={reportKey}
                onChange={setReportKey}
                options={reportsInCategory.map((r) => ({ value: r.key, label: r.label }))}
                isClearable={false}
              />
            </div>

            {activeReport && (
              <div className="reports-filters">
                {activeReport.params.map((p) => (
                  <div className="sale-field" key={p.name}>
                    <label>{paramLabel(p.name)}{p.required ? " *" : ""}</label>
                    {renderParamInput(p)}
                  </div>
                ))}
                <button className="btn-primary reports-run-btn" onClick={runReport} disabled={loading}>
                  {loading ? "Running..." : "Run Report"}
                </button>
                {rows && rows.length > 0 && (
                  <button className="btn-secondary reports-export-btn" onClick={exportCsv}>Export CSV</button>
                )}
              </div>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          {rows && (
            <div className="reports-results">
              <div className="reports-results-meta">{rows.length} row{rows.length === 1 ? "" : "s"}</div>
              <div className="reports-table-wrap">
                <table>
                  <thead>
                    <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        {columns.map((c) => {
                          const v = r[c];
                          const isNumeric = v !== null && v !== "" && typeof v !== "boolean" && !isNaN(Number(v));
                          return (
                            <td key={c} className={isNumeric ? "num" : ""}>
                              {v === null || v === undefined ? "" : String(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={Math.max(columns.length, 1)} className="muted">No data for the selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
