import { useEffect, useState } from "react";
import { api } from "../api/client";
import SearchableSelect from "../components/SearchableSelect";
import ItemFinder from "../components/ItemFinder";
import PaginationBar from "../components/PaginationBar";
import SearchBox from "../components/SearchBox";
import "./StockPage.css";
import "./UserRolePage.css";
import "./SalePage.css";

export default function StockAdjustmentPage() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [currentQty, setCurrentQty] = useState(null);
  const [newQty, setNewQty] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    api.listEntity("branches", { pageSize: 1000 }).then((r) => {
      setBranches(r.data);
      if (r.data.length > 0) setBranchId(r.data[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  function loadHistory() {
    api.listStockAdjustments({ q: search, page, pageSize, fromDate, toDate }).then((r) => {
      setHistory(r.data);
      setTotalPages(r.totalPages);
      setTotal(r.total);
    }).catch((e) => setHistoryError(e.message));
  }

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, pageSize, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [search, fromDate, toDate, pageSize]);

  async function selectStock(stock) {
    setError("");
    setMessage("");
    if (!branchId) {
      setError("Still loading branches - please try again in a moment.");
      return;
    }
    setSelectedStock(stock);
    setNewQty("");
    try {
      const result = await api.getStockBalance(stock.StockID, branchId);
      setCurrentQty(result.qty);
    } catch (err) {
      setError(err.message);
    }
  }

  function cancel() {
    setSelectedStock(null);
    setCurrentQty(null);
    setNewQty("");
    setError("");
  }

  async function save() {
    setError("");
    setMessage("");
    if (!selectedStock) { setError("Please select a stock item."); return; }
    if (newQty === "") { setError("New Stock Level can not be blank."); return; }

    setSaving(true);
    try {
      await api.createStockAdjustment({
        stockId: selectedStock.StockID,
        branchId,
        newQty: Number(newQty),
        user: "web",
      });
      setMessage(`Stock level for ${selectedStock.StockName} adjusted from ${currentQty} to ${newQty}.`);
      cancel();
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sale-page">
      <div className="sale-top-row">
        <div className="sale-field">
          <label>Branch</label>
          <SearchableSelect
            value={branchId}
            onChange={setBranchId}
            options={branches.map((b) => ({ value: b.id, label: b.branchname }))}
            isClearable={false}
          />
        </div>
      </div>

      <ItemFinder onSelect={selectStock} placeholder="Scan barcode or search item to adjust..." />

      {error && <div className="error">{error}</div>}
      {message && <div className="role-success">{message}</div>}

      {selectedStock && (
        <div className="role-group" style={{ maxWidth: 420, marginTop: 14 }}>
          <h3>{selectedStock.StockName} ({selectedStock.StockCode})</h3>

          <div className="summary-rows">
            <div className="summary-row">
              <span className="summary-label">Current Stock</span>
              <span className="summary-value">{currentQty}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">New Stock Level</span>
              <input type="number" className="summary-input" value={newQty}
                onChange={(e) => setNewQty(e.target.value)} autoFocus />
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 16, borderBottom: "none", paddingBottom: 0 }}>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Adjustment"}
            </button>
            <button className="btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      <div className="sale-history">
        <h3>Adjustment History</h3>

        <div className="sale-list-filters">
          <SearchBox placeholder="Search stock name or code..." value={search} onChange={setSearch} />
          <label className="date-filter-label">
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="date-filter-label">
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          {(fromDate || toDate) && (
            <button className="btn-secondary sale-action-btn" onClick={() => { setFromDate(""); setToDate(""); }}>
              Clear Dates
            </button>
          )}
        </div>

        {historyError && <div className="error">{historyError}</div>}

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Stock</th>
              <th>Current Qty</th>
              <th>Adjusted Qty</th>
              <th>Difference</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => {
              const diff = Number(h.AdjustedQty) - Number(h.CurrentQty);
              return (
                <tr key={h.AdjustmentID}>
                  <td>{h.AdjustmentDate ? h.AdjustmentDate.slice(0, 16).replace("T", " ") : ""}</td>
                  <td>{h.StockName} ({h.StockCode})</td>
                  <td className="num">{Number(h.CurrentQty).toLocaleString()}</td>
                  <td className="num">{Number(h.AdjustedQty).toLocaleString()}</td>
                  <td className="num" style={{ color: diff >= 0 ? "#00695c" : "#b71c1c" }}>
                    {diff >= 0 ? "+" : ""}{diff.toLocaleString()}
                  </td>
                  <td>{h.CreateUser}</td>
                </tr>
              );
            })}
            {history.length === 0 && (
              <tr><td colSpan={6} className="muted">No adjustments found.</td></tr>
            )}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
}
