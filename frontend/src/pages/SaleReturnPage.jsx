import { useEffect, useState } from "react";
import { api } from "../api/client";
import PaginationBar from "../components/PaginationBar";
import SearchBox from "../components/SearchBox";
import SaleReturnDetailModal from "../components/SaleReturnDetailModal";
import RowActionsMenu from "../components/RowActionsMenu";
import LoadingOverlay from "../components/LoadingOverlay";
import { EyeIcon, TrashIcon } from "../components/icons";
import "./StockPage.css";
import "./UserRolePage.css";
import "./SalePage.css";

export default function SaleReturnPage() {
  const [saleSearch, setSaleSearch] = useState("");
  const [saleResults, setSaleResults] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]); // { saleDtlId, stockId, stockName, origQty, qty, price, removed }
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [viewingReturn, setViewingReturn] = useState(null);

  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  function loadHistory() {
    setHistoryLoading(true);
    api.listSaleReturns({ q: historySearch, page, pageSize, fromDate, toDate }).then((r) => {
      setHistory(r.data);
      setTotalPages(r.totalPages);
      setTotal(r.total);
    }).catch((e) => setHistoryError(e.message)).finally(() => setHistoryLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySearch, page, pageSize, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [fromDate, toDate, historySearch, pageSize]);

  useEffect(() => {
    if (!saleSearch.trim()) { setSaleResults([]); return; }
    const t = setTimeout(() => {
      api.listSales({ q: saleSearch, pageSize: 10 }).then((r) => setSaleResults(r.data)).catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [saleSearch]);

  async function pickSale(saleId) {
    setError("");
    setMessage("");
    setPicking(true);
    try {
      const sale = await api.getSale(saleId);
      setSelectedSale(sale);
      setReturnItems(
        sale.items.map((d) => ({
          saleDtlId: d.SaleDtlID,
          stockId: Number(d.StockCode),
          stockName: d.StockName,
          origQty: Number(d.Qty),
          qty: Number(d.Qty),
          price: Number(d.Price),
          removed: false,
        }))
      );
      setSaleResults([]);
      setSaleSearch("");
    } catch (err) {
      setError(err.message);
    } finally {
      setPicking(false);
    }
  }

  function updateQty(saleDtlId, value) {
    setReturnItems((prev) => prev.map((it) => {
      if (it.saleDtlId !== saleDtlId) return it;
      let qty = Number(value);
      if (qty > it.origQty) qty = it.origQty;
      if (qty < 0) qty = 0;
      return { ...it, qty };
    }));
  }

  function removeItem(saleDtlId) {
    setReturnItems((prev) => prev.filter((it) => it.saleDtlId !== saleDtlId));
  }

  const activeItems = returnItems.filter((it) => it.qty > 0);
  const returnAmount = activeItems.reduce((sum, it) => sum + it.qty * it.price, 0);
  const prevLeftover = selectedSale ? Number(selectedSale.LeftOver) || 0 : 0;
  const returnBalance = returnAmount + prevLeftover;

  function resetForm() {
    setSelectedSale(null);
    setReturnItems([]);
    setNote("");
  }

  async function save() {
    setError("");
    setMessage("");
    if (!selectedSale) { setError("Please select a sale to return items from."); return; }
    if (activeItems.length === 0) { setError("Add at least one item to return."); return; }

    if (!window.confirm("Are you sure you want to save this return voucher?")) return;

    setSaving(true);
    try {
      const body = {
        saleId: selectedSale.SaleID,
        note,
        items: activeItems.map((i) => ({ stockId: i.stockId, qty: i.qty, price: i.price })),
      };
      const result = await api.createSaleReturn(body);
      setMessage(`Return for sale ${result.saleCode} saved - Amount ${result.returnAmount.toLocaleString()}.`);
      resetForm();
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleView(id) {
    setHistoryError("");
    try {
      const ret = await api.getSaleReturn(id);
      setViewingReturn(ret);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this sale return? This will reverse stock and cannot be undone.")) return;
    setHistoryError("");
    try {
      await api.deleteSaleReturn(id);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  return (
    <div className="sale-page">
      {!selectedSale ? (
        <div className="sale-summary role-group">
          <h3>Find Sale to Return</h3>
          <SearchBox placeholder="Search sale code or customer name..." value={saleSearch} onChange={setSaleSearch} />
          {error && <div className="error">{error}</div>}
          {saleResults.length > 0 && (
            <table style={{ marginTop: 10 }}>
              <thead>
                <tr><th>Sale Code</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {saleResults.map((s) => (
                  <tr key={s.SaleID}>
                    <td>{s.SaleCode}</td>
                    <td>{s.SaleDate ? s.SaleDate.slice(0, 10) : ""}</td>
                    <td>{s.PatientName}</td>
                    <td className="num">{Number(s.TotalAmount).toLocaleString()}</td>
                    <td>{s.Status}</td>
                    <td><button className="btn-secondary sale-action-btn" onClick={() => pickSale(s.SaleID)} disabled={picking}>{picking ? "Loading..." : "Select"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div className="editing-banner">
            Returning items from <strong>{selectedSale.SaleCode}</strong> ({selectedSale.PatientName})
            <button className="btn-secondary editing-cancel-btn" onClick={resetForm}>Cancel</button>
          </div>

          {error && <div className="error">{error}</div>}
          {message && <div className="role-success">{message}</div>}

          <table className="sale-cart">
            <thead>
              <tr>
                <th>Item</th>
                <th>Original Qty</th>
                <th>Return Qty</th>
                <th>Price</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {returnItems.map((i) => (
                <tr key={i.saleDtlId}>
                  <td>{i.stockName}</td>
                  <td className="num">{i.origQty}</td>
                  <td>
                    <input type="number" className="cart-qty" value={i.qty} max={i.origQty} min={0}
                      onChange={(e) => updateQty(i.saleDtlId, e.target.value)} />
                  </td>
                  <td className="num">{i.price.toLocaleString()}</td>
                  <td className="num">{(i.qty * i.price).toLocaleString()}</td>
                  <td>
                    <button className="cart-remove" onClick={() => removeItem(i.saleDtlId)}>&#10005;</button>
                  </td>
                </tr>
              ))}
              {returnItems.length === 0 && (
                <tr><td colSpan={6} className="muted">No items left to return.</td></tr>
              )}
            </tbody>
          </table>

          <div className="sale-bottom">
            <div className="sale-summary role-group" style={{ marginLeft: "auto" }}>
              <h3>Return Info</h3>
              <div className="summary-field">
                <label>Note</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note..." />
              </div>
              <div className="summary-rows">
                <div className="summary-row">
                  <span className="summary-label">Return Amount</span>
                  <span className="summary-value">{returnAmount.toLocaleString()}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Prev Leftover</span>
                  <span className="summary-value">{prevLeftover.toLocaleString()}</span>
                </div>
                <div className="summary-divider" />
                <div className="summary-row total-row">
                  <span className="summary-label">Return Balance</span>
                  <span className="summary-value">{returnBalance.toLocaleString()}</span>
                </div>
              </div>
              <button className="btn-primary sale-save" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save Return"}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="sale-history">
        <h3>Sale Return List</h3>

        <div className="sale-list-filters">
          <SearchBox placeholder="Search sale code or customer..." value={historySearch} onChange={setHistorySearch} />
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

        <div className="history-table-wrap">
          <LoadingOverlay show={historyLoading} />
        <table>
          <thead>
            <tr>
              <th>Sale Code</th>
              <th>Return Date</th>
              <th>Customer</th>
              <th>Return Amount</th>
              <th>Return Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.SaleReturnHDRID}>
                <td>{h.SaleCode}</td>
                <td>{h.ReturnDate ? h.ReturnDate.slice(0, 10) : ""}</td>
                <td>{h.PatientName}</td>
                <td className="num">{Number(h.ReturnAmount).toLocaleString()}</td>
                <td className="num">{Number(h.ReturnBalance).toLocaleString()}</td>
                <td className="sale-actions">
                  <RowActionsMenu
                    actions={[
                      { label: "View", icon: <EyeIcon />, onClick: () => handleView(h.SaleReturnHDRID) },
                      { label: "Delete", icon: <TrashIcon />, onClick: () => handleDelete(h.SaleReturnHDRID), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {history.length === 0 && !historyLoading && (
              <tr><td colSpan={6} className="muted">No sale returns found.</td></tr>
            )}
          </tbody>
        </table>
        </div>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {viewingReturn && <SaleReturnDetailModal returnData={viewingReturn} onClose={() => setViewingReturn(null)} />}
    </div>
  );
}
