import { useEffect, useState } from "react";
import { api } from "../api/client";
import SearchableSelect from "../components/SearchableSelect";
import ItemFinder from "../components/ItemFinder";
import PaginationBar from "../components/PaginationBar";
import SearchBox from "../components/SearchBox";
import TransferDetailModal from "../components/TransferDetailModal";
import RowActionsMenu from "../components/RowActionsMenu";
import { EyeIcon, CheckCircleIcon, TrashIcon } from "../components/icons";
import "./StockPage.css";
import "./UserRolePage.css";
import "./SalePage.css";

export default function TransferPage() {
  const [branches, setBranches] = useState([]);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferBy, setTransferBy] = useState("");
  const [remark, setRemark] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewingTransfer, setViewingTransfer] = useState(null);

  const [viewBranchId, setViewBranchId] = useState("");
  const [historyView, setHistoryView] = useState("out"); // out | in
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    api.listEntity("branches", { pageSize: 1000 }).then((r) => {
      setBranches(r.data);
      if (r.data.length > 0) {
        setFromBranchId(r.data[0].id);
        setViewBranchId(r.data[0].id);
      }
    }).catch((e) => setError(e.message));
  }, []);

  function loadHistory() {
    if (!viewBranchId) return;
    api.listTransfers({ q: historySearch, page, pageSize, view: historyView, branchId: viewBranchId, fromDate, toDate }).then((r) => {
      setHistory(r.data);
      setTotalPages(r.totalPages);
      setTotal(r.total);
    }).catch((e) => setHistoryError(e.message));
  }

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySearch, page, pageSize, historyView, viewBranchId, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [historyView, viewBranchId, fromDate, toDate, historySearch, pageSize]);

  function addItem(stock) {
    setItems((prev) => {
      const existing = prev.find((i) => i.stockId === stock.StockID);
      if (existing) {
        return prev.map((i) => i.stockId === stock.StockID ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        stockId: stock.StockID,
        stockName: stock.StockName,
        qty: 1,
        price: Number(stock.sellprice) || 0,
      }];
    });
  }

  function updateItem(stockId, field, value) {
    setItems((prev) => prev.map((i) => i.stockId === stockId ? { ...i, [field]: value } : i));
  }

  function removeItem(stockId) {
    setItems((prev) => prev.filter((i) => i.stockId !== stockId));
  }

  const total_amount = items.reduce((sum, i) => sum + Number(i.qty) * Number(i.price), 0);

  function resetForm() {
    setToBranchId("");
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferBy("");
    setRemark("");
    setItems([]);
  }

  async function save() {
    setError("");
    setMessage("");
    if (!toBranchId) { setError("Please select the destination branch."); return; }
    if (fromBranchId === toBranchId) { setError("From and To branch must be different."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }

    setSaving(true);
    try {
      const result = await api.createTransfer({
        fromBranchId,
        toBranchId,
        transferDate,
        transferBy,
        remark,
        items: items.map((i) => ({ stockId: i.stockId, qty: Number(i.qty), price: Number(i.price) })),
        user: "web",
      });
      setMessage(`Transfer ${result.transferCode} saved - Total ${result.totalAmount.toLocaleString()}.`);
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
      const transfer = await api.getTransfer(id);
      setViewingTransfer(transfer);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleReceive(id) {
    if (!window.confirm("Are you sure you want to receive this transfer?")) return;
    setHistoryError("");
    try {
      await api.receiveTransfer(id);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this transfer? This will restore stock and cannot be undone.")) return;
    setHistoryError("");
    try {
      await api.deleteTransfer(id);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  return (
    <div className="sale-page">
      <div className="sale-top-row">
        <div className="sale-field">
          <label>From Branch</label>
          <SearchableSelect
            value={fromBranchId}
            onChange={setFromBranchId}
            options={branches.map((b) => ({ value: b.id, label: b.branchname }))}
            isClearable={false}
          />
        </div>
        <div className="sale-field">
          <label>To Branch</label>
          <SearchableSelect
            placeholder="Select destination..."
            value={toBranchId}
            onChange={setToBranchId}
            options={branches.filter((b) => b.id !== fromBranchId).map((b) => ({ value: b.id, label: b.branchname }))}
          />
        </div>
        <div className="sale-field">
          <label>Transfer Date</label>
          <input type="date" className="sale-date-input" value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)} />
        </div>
        <div className="sale-field">
          <label>Transfer By</label>
          <input className="sale-date-input" value={transferBy} onChange={(e) => setTransferBy(e.target.value)} />
        </div>
      </div>

      <ItemFinder onSelect={addItem} placeholder="Scan barcode or search item to transfer..." />

      {error && <div className="error">{error}</div>}
      {message && <div className="role-success">{message}</div>}

      <table className="sale-cart">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.stockId}>
              <td>{i.stockName}</td>
              <td>
                <input type="number" className="cart-qty" value={i.qty}
                  onChange={(e) => updateItem(i.stockId, "qty", e.target.value)} />
              </td>
              <td>
                <input type="number" className="cart-price" value={i.price}
                  onChange={(e) => updateItem(i.stockId, "price", e.target.value)} />
              </td>
              <td className="num">{(i.qty * i.price).toLocaleString()}</td>
              <td>
                <button className="cart-remove" onClick={() => removeItem(i.stockId)}>&#10005;</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={5} className="muted">No items added yet.</td></tr>
          )}
        </tbody>
      </table>

      <div className="sale-bottom">
        <div className="sale-summary role-group" style={{ marginLeft: "auto" }}>
          <h3>Transfer Info</h3>
          <div className="summary-field">
            <label>Remark</label>
            <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Optional remark..." />
          </div>
          <div className="summary-rows">
            <div className="summary-row total-row">
              <span className="summary-label">Total</span>
              <span className="summary-value">{total_amount.toLocaleString()}</span>
            </div>
          </div>
          <button className="btn-primary sale-save" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Transfer"}
          </button>
        </div>
      </div>

      <div className="sale-history">
        <h3>Transfer List</h3>

        <div className="sale-top-row" style={{ marginBottom: 8 }}>
          <div className="sale-field">
            <label>Viewing Branch</label>
            <SearchableSelect
              value={viewBranchId}
              onChange={setViewBranchId}
              options={branches.map((b) => ({ value: b.id, label: b.branchname }))}
              isClearable={false}
            />
          </div>
        </div>

        <div className="sale-list-tabs">
          <button className={historyView === "out" ? "active" : ""} onClick={() => setHistoryView("out")}>Sent</button>
          <button className={historyView === "in" ? "active" : ""} onClick={() => setHistoryView("in")}>Received</button>
        </div>

        <div className="sale-list-filters">
          <SearchBox placeholder="Search transfer code..." value={historySearch} onChange={setHistorySearch} />
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
              <th>Transfer Code</th>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.TransferID}>
                <td>{h.TransferCode}</td>
                <td>{h.TransferDate ? h.TransferDate.slice(0, 10) : ""}</td>
                <td>{h.FromBranchName}</td>
                <td>{h.ToBranchName}</td>
                <td className="num">{Number(h.TotalAmount).toLocaleString()}</td>
                <td>{h.TransferStatus}</td>
                <td className="sale-actions">
                  <RowActionsMenu
                    actions={[
                      { label: "View", icon: <EyeIcon />, onClick: () => handleView(h.TransferID) },
                      ...(historyView === "in" && h.TransferStatus === "Open"
                        ? [{ label: "Receive", icon: <CheckCircleIcon />, onClick: () => handleReceive(h.TransferID) }]
                        : []),
                      ...(historyView === "out" && h.TransferStatus === "Open"
                        ? [{ label: "Delete", icon: <TrashIcon />, onClick: () => handleDelete(h.TransferID), danger: true }]
                        : []),
                    ]}
                  />
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={7} className="muted">No transfers found.</td></tr>
            )}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {viewingTransfer && <TransferDetailModal transfer={viewingTransfer} onClose={() => setViewingTransfer(null)} />}
    </div>
  );
}
