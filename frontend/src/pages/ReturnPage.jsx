import { useEffect, useState } from "react";
import { api } from "../api/client";
import SearchableSelect from "../components/SearchableSelect";
import ItemFinder from "../components/ItemFinder";
import PaginationBar from "../components/PaginationBar";
import SearchBox from "../components/SearchBox";
import ReturnDetailModal from "../components/ReturnDetailModal";
import RowActionsMenu from "../components/RowActionsMenu";
import { EyeIcon, TrashIcon } from "../components/icons";
import "./StockPage.css";
import "./UserRolePage.css";
import "./SalePage.css";

export default function ReturnPage() {
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [returnType, setReturnType] = useState("RETURN"); // RETURN | DAMAGE
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState([]);
  const [paid, setPaid] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewingReturn, setViewingReturn] = useState(null);

  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [historyType, setHistoryType] = useState(""); // "" | RETURN | DAMAGE
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    api.listEntity("branches", { pageSize: 1000 }).then((r) => {
      setBranches(r.data);
      if (r.data.length > 0) setBranchId(r.data[0].id);
    }).catch((e) => setError(e.message));
    api.listEntity("suppliers", { pageSize: 1000 }).then((r) => setSuppliers(r.data)).catch((e) => setError(e.message));
  }, []);

  function loadHistory() {
    api.listReturns({ q: historySearch, page, pageSize, type: historyType, fromDate, toDate }).then((r) => {
      setHistory(r.data);
      setTotalPages(r.totalPages);
      setTotal(r.total);
    }).catch((e) => setHistoryError(e.message));
  }

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySearch, page, pageSize, historyType, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [historyType, fromDate, toDate, historySearch, pageSize]);

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this voucher? This will reverse stock and cannot be undone.")) return;
    setHistoryError("");
    try {
      await api.deleteReturn(id);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleView(id) {
    setHistoryError("");
    try {
      const ret = await api.getReturn(id);
      setViewingReturn(ret);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

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

  const totalAmount = items.reduce((sum, i) => sum + Number(i.qty) * Number(i.price), 0);
  const isDamage = returnType === "DAMAGE";
  const effectivePaid = isDamage ? totalAmount : Number(paid || 0);
  const leftover = totalAmount - effectivePaid;

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setSupplierId("");
    setItems([]);
    setPaid(0);
    setNote("");
  }

  async function save() {
    setError("");
    setMessage("");
    if (returnType === "RETURN" && !supplierId) { setError("Please select a supplier."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }

    setSaving(true);
    try {
      const body = {
        branchId,
        type: returnType,
        date,
        supplierId: isDamage ? null : supplierId,
        paid: isDamage ? totalAmount : Number(paid) || 0,
        note,
        items: items.map((i) => ({ stockId: i.stockId, qty: Number(i.qty), price: Number(i.price) })),
      };
      const result = await api.createReturn(body);
      setMessage(`${returnType === "DAMAGE" ? "Damage" : "Return"} ${result.returnCode} saved - Total ${result.totalAmount.toLocaleString()}.`);
      resetForm();
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
        <div className="sale-field">
          <label>Type</label>
          <div className="sale-list-tabs" style={{ marginBottom: 0 }}>
            <button className={returnType === "RETURN" ? "active" : ""} onClick={() => setReturnType("RETURN")} type="button">Return</button>
            <button className={returnType === "DAMAGE" ? "active" : ""} onClick={() => setReturnType("DAMAGE")} type="button">Damage</button>
          </div>
        </div>
        <div className="sale-field">
          <label>Date</label>
          <input type="date" className="sale-date-input" value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        {!isDamage && (
          <div className="sale-field sale-field-wide">
            <label>Supplier</label>
            <SearchableSelect
              placeholder="Select a supplier..."
              value={supplierId}
              onChange={setSupplierId}
              options={suppliers.map((s) => ({ value: s.SupplierID, label: s.SupplierName }))}
            />
          </div>
        )}
      </div>

      <ItemFinder onSelect={addItem} placeholder="Scan barcode or search item to add..." />

      {error && <div className="error">{error}</div>}
      {message && <div className="role-success">{message}</div>}

      <table className="sale-cart">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Amount</th>
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
          <h3>{isDamage ? "Damage Info" : "Payment Info"}</h3>

          <div className="summary-field">
            <label>Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note..." />
          </div>

          <div className="summary-rows">
            <div className="summary-row total-row">
              <span className="summary-label">Total</span>
              <span className="summary-value">{totalAmount.toLocaleString()}</span>
            </div>
            {!isDamage && (
              <>
                <div className="summary-row">
                  <span className="summary-label">Paid</span>
                  <input type="number" className="summary-input" value={paid} onChange={(e) => setPaid(e.target.value)} />
                </div>
                <div className="summary-row leftover-row">
                  <span className="summary-label">Leftover</span>
                  <span className="summary-value">{leftover.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          <button className="btn-primary sale-save" onClick={save} disabled={saving}>
            {saving ? "Saving..." : returnType === "DAMAGE" ? "Save Damage" : "Save Return"}
          </button>
        </div>
      </div>

      <div className="sale-history">
        <h3>Return / Damage List</h3>

        <div className="sale-list-tabs">
          <button className={historyType === "" ? "active" : ""} onClick={() => setHistoryType("")}>All</button>
          <button className={historyType === "RETURN" ? "active" : ""} onClick={() => setHistoryType("RETURN")}>Return</button>
          <button className={historyType === "DAMAGE" ? "active" : ""} onClick={() => setHistoryType("DAMAGE")}>Damage</button>
        </div>

        <div className="sale-list-filters">
          <SearchBox placeholder="Search return code or supplier..." value={historySearch} onChange={setHistorySearch} />
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
              <th>Return Code</th>
              <th>Date</th>
              <th>Type</th>
              <th>Supplier</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Leftover</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.ReturnID}>
                <td>{h.ReturnCode}</td>
                <td>{h.Date ? h.Date.slice(0, 10) : ""}</td>
                <td>{h.Type}</td>
                <td>{h.SupplierName}</td>
                <td className="num">{Number(h.TotalAmount).toLocaleString()}</td>
                <td className="num">{Number(h.Paid).toLocaleString()}</td>
                <td className="num">{Number(h.LeftOver).toLocaleString()}</td>
                <td>{h.Status}</td>
                <td className="sale-actions">
                  <RowActionsMenu
                    actions={[
                      { label: "View", icon: <EyeIcon />, onClick: () => handleView(h.ReturnID) },
                      { label: "Delete", icon: <TrashIcon />, onClick: () => handleDelete(h.ReturnID), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={9} className="muted">No returns found.</td></tr>
            )}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {viewingReturn && <ReturnDetailModal returnData={viewingReturn} onClose={() => setViewingReturn(null)} />}
    </div>
  );
}
