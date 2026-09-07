import { useEffect, useState } from "react";
import { api } from "../api/client";
import SearchableSelect from "../components/SearchableSelect";
import ItemFinder from "../components/ItemFinder";
import PaginationBar from "../components/PaginationBar";
import SearchBox from "../components/SearchBox";
import { printPurchaseVoucher } from "../lib/printVoucher";
import PurchaseDetailModal from "../components/PurchaseDetailModal";
import RowActionsMenu from "../components/RowActionsMenu";
import { EyeIcon, EditIcon, PrinterIcon, CheckCircleIcon, TrashIcon } from "../components/icons";
import "./StockPage.css";
import "./UserRolePage.css";
import "./SalePage.css";

export default function PurchasePage() {
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paid, setPaid] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [editingPurchaseCode, setEditingPurchaseCode] = useState("");
  const [viewingPurchase, setViewingPurchase] = useState(null);

  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [historyView, setHistoryView] = useState("paid"); // paid | unpaid
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [counts, setCounts] = useState({ paid: null, unpaid: null });

  useEffect(() => {
    api.listEntity("branches", { pageSize: 1000 }).then((r) => {
      setBranches(r.data);
      if (r.data.length > 0) setBranchId(r.data[0].id);
    }).catch((e) => setError(e.message));
    api.listEntity("suppliers", { pageSize: 1000 }).then((r) => setSuppliers(r.data)).catch((e) => setError(e.message));
  }, []);

  function loadHistory() {
    api.listPurchases({ q: historySearch, page, pageSize, view: historyView, fromDate, toDate }).then((r) => {
      setHistory(r.data);
      setTotalPages(r.totalPages);
      setTotal(r.total);
      setCounts((c) => ({ ...c, [historyView]: r.total }));
    }).catch((e) => setHistoryError(e.message));
  }

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySearch, page, pageSize, historyView, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [historyView, fromDate, toDate, historySearch, pageSize]);

  async function handleMarkPaid(purchaseId) {
    if (!window.confirm("Are you sure you want to mark this voucher as paid?")) return;
    setHistoryError("");
    try {
      await api.markPurchasePaid(purchaseId);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleDeletePurchase(purchaseId) {
    if (!window.confirm("Are you sure you want to delete this voucher? This will reverse stock and cannot be undone.")) return;
    setHistoryError("");
    try {
      await api.deletePurchase(purchaseId);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handlePrint(purchaseId) {
    try {
      const purchase = await api.getPurchase(purchaseId);
      printPurchaseVoucher(purchase);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleView(purchaseId) {
    setHistoryError("");
    try {
      const purchase = await api.getPurchase(purchaseId);
      setViewingPurchase(purchase);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleEdit(purchaseId) {
    setError("");
    setMessage("");
    try {
      const purchase = await api.getPurchase(purchaseId);
      setEditingPurchaseId(purchase.PurchaseID);
      setEditingPurchaseCode(purchase.PurchaseCode);
      setBranchId(purchase.BranchID);
      setPurchaseDate((purchase.PurchaseDate || "").slice(0, 10));
      setSupplierId(purchase.SupplierID);
      setDiscount(Number(purchase.Discount) || 0);
      setTax(Number(purchase.Tax) || 0);
      setPaid(Number(purchase.Paid) || 0);
      setNote(purchase.Note || "");
      setItems(
        purchase.items.map((d) => ({
          stockId: Number(d.StockCode),
          stockName: d.StockName,
          qty: Number(d.Qty),
          price: Number(d.Price),
        }))
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
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
        stockCode: stock.StockCode,
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

  const itemsTotal = items.reduce((sum, i) => sum + Number(i.qty) * Number(i.price), 0);
  const totalAmount = itemsTotal - Number(discount || 0) + Number(tax || 0);
  const leftover = totalAmount - Number(paid || 0);

  function resetForm() {
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setSupplierId("");
    setItems([]);
    setDiscount(0);
    setTax(0);
    setPaid(0);
    setNote("");
    setEditingPurchaseId(null);
    setEditingPurchaseCode("");
  }

  async function save() {
    setError("");
    setMessage("");
    if (!supplierId) { setError("Please select a supplier."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }

    setSaving(true);
    try {
      const body = {
        branchId,
        purchaseDate,
        supplierId,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        paid: Number(paid) || 0,
        note,
        items: items.map((i) => ({ stockId: i.stockId, qty: Number(i.qty), price: Number(i.price) })),
      };
      const result = editingPurchaseId
        ? await api.updatePurchase(editingPurchaseId, body)
        : await api.createPurchase(body);
      setMessage(`Purchase ${result.purchaseCode} ${editingPurchaseId ? "updated" : "saved"} - Total ${result.totalAmount.toLocaleString()}, ${result.status}.`);
      resetForm();
      loadHistory();

      if (window.confirm(`Purchase ${result.purchaseCode} saved. Do you want to print the voucher?`)) {
        handlePrint(result.purchaseId);
      }
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
          <label>Purchase Date</label>
          <input type="date" className="sale-date-input" value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
        <div className="sale-field sale-field-wide">
          <label>Supplier</label>
          <SearchableSelect
            placeholder="Select a supplier..."
            value={supplierId}
            onChange={setSupplierId}
            options={suppliers.map((s) => ({ value: s.SupplierID, label: s.SupplierName }))}
          />
        </div>
      </div>

      {editingPurchaseId && (
        <div className="editing-banner">
          Editing purchase <strong>{editingPurchaseCode}</strong>
          <button className="btn-secondary editing-cancel-btn" onClick={resetForm}>Cancel Edit</button>
        </div>
      )}

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
          <h3>Payment Info</h3>

          <div className="summary-field">
            <label>Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note..." />
          </div>

          <div className="summary-rows">
            <div className="summary-row">
              <span className="summary-label">Subtotal</span>
              <span className="summary-value">{itemsTotal.toLocaleString()}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Discount</span>
              <input type="number" className="summary-input" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="summary-row">
              <span className="summary-label">Tax</span>
              <input type="number" className="summary-input" value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
            <div className="summary-divider" />
            <div className="summary-row total-row">
              <span className="summary-label">Total</span>
              <span className="summary-value">{totalAmount.toLocaleString()}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Paid</span>
              <input type="number" className="summary-input" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
            <div className="summary-row leftover-row">
              <span className="summary-label">Leftover</span>
              <span className="summary-value">{leftover.toLocaleString()}</span>
            </div>
          </div>

          <button className="btn-primary sale-save" onClick={save} disabled={saving}>
            {saving ? "Saving..." : editingPurchaseId ? "Update Purchase" : "Save Purchase"}
          </button>
        </div>
      </div>

      <div className="sale-history">
        <h3>Purchase List</h3>

        <div className="sale-list-tabs">
          <button className={historyView === "paid" ? "active" : ""} onClick={() => setHistoryView("paid")}>
            Paid{counts.paid !== null ? ` (${counts.paid})` : ""}
          </button>
          <button className={historyView === "unpaid" ? "active" : ""} onClick={() => setHistoryView("unpaid")}>
            Unpaid{counts.unpaid !== null ? ` (${counts.unpaid})` : ""}
          </button>
        </div>

        <div className="sale-list-filters">
          <SearchBox placeholder="Search purchase code or supplier..." value={historySearch} onChange={setHistorySearch} />
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
              <th>Purchase Code</th>
              <th>Date</th>
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
              <tr key={h.PurchaseID}>
                <td>{h.PurchaseCode}</td>
                <td>{h.PurchaseDate ? h.PurchaseDate.slice(0, 10) : ""}</td>
                <td>{h.SupplierName}</td>
                <td className="num">{Number(h.TotalAmount).toLocaleString()}</td>
                <td className="num">{Number(h.Paid).toLocaleString()}</td>
                <td className="num">{Number(h.LeftOver).toLocaleString()}</td>
                <td>{h.Status}</td>
                <td className="sale-actions">
                  <RowActionsMenu
                    actions={[
                      { label: "View", icon: <EyeIcon />, onClick: () => handleView(h.PurchaseID) },
                      { label: "Edit", icon: <EditIcon />, onClick: () => handleEdit(h.PurchaseID) },
                      { label: "Print", icon: <PrinterIcon />, onClick: () => handlePrint(h.PurchaseID) },
                      ...(historyView === "unpaid"
                        ? [{ label: "Mark Paid", icon: <CheckCircleIcon />, onClick: () => handleMarkPaid(h.PurchaseID) }]
                        : []),
                      { label: "Delete", icon: <TrashIcon />, onClick: () => handleDeletePurchase(h.PurchaseID), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={8} className="muted">No purchases found.</td></tr>
            )}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {viewingPurchase && <PurchaseDetailModal purchase={viewingPurchase} onClose={() => setViewingPurchase(null)} />}
    </div>
  );
}
