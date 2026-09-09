import { useEffect, useState } from "react";
import { api } from "../api/client";
import SearchableSelect from "../components/SearchableSelect";
import ItemFinder from "../components/ItemFinder";
import PaginationBar from "../components/PaginationBar";
import { printSaleVoucher } from "../lib/printVoucher";
import SaleDetailModal from "../components/SaleDetailModal";
import AddCustomerModal from "../components/AddCustomerModal";
import PhoneCallLink from "../components/PhoneCallLink";
import RowActionsMenu from "../components/RowActionsMenu";
import LoadingOverlay from "../components/LoadingOverlay";
import { EyeIcon, EditIcon, PrinterIcon, CheckCircleIcon, UndoIcon, TruckIcon, TrashIcon } from "../components/icons";
import "./StockPage.css";
import "./UserRolePage.css";
import "../components/SearchBox.css";
import "./SalePage.css";

function toDatetimeLocal(value) {
  if (!value) return "";
  // "2026-02-05 14:30:00" -> "2026-02-05T14:30"
  return value.replace(" ", "T").slice(0, 16);
}

const emptyOptic = {
  memberid: "",
  deliverydate: "",
  sphereod: "", sphereos: "",
  cylinderod: "", cylinderos: "",
  axisod: "", axisos: "",
  prismod: "", prismos: "",
  pdmm: "",
  deliver: false,
};

export default function SalePage() {
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paid, setPaid] = useState(0);
  const [note, setNote] = useState("");
  const [optic, setOptic] = useState(emptyOptic);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [editingSaleCode, setEditingSaleCode] = useState("");
  const [viewingSale, setViewingSale] = useState(null);
  const [customerSearchText, setCustomerSearchText] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [historyView, setHistoryView] = useState("paid"); // paid | unpaid | order
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [counts, setCounts] = useState({ paid: null, unpaid: null, order: null });

  useEffect(() => {
    api.listEntity("branches", { pageSize: 1000 }).then((r) => {
      setBranches(r.data);
      if (r.data.length > 0) setBranchId(r.data[0].id);
    }).catch((e) => setError(e.message));
    api.listEntity("customers", { pageSize: 1000 }).then((r) => setCustomers(r.data)).catch((e) => setError(e.message));
  }, []);

  function loadHistory() {
    setHistoryLoading(true);
    api.listSales({ q: historySearch, page, pageSize, view: historyView, fromDate, toDate }).then((r) => {
      setHistory(r.data);
      setTotalPages(r.totalPages);
      setTotal(r.total);
      setCounts((c) => ({ ...c, [historyView]: r.total }));
    }).catch((e) => setHistoryError(e.message)).finally(() => setHistoryLoading(false));
  }

  // loadHistory only fills in the count for whichever tab is currently
  // active, so the other two tabs' counts stayed blank until the user
  // clicked into them. Fetch all three (pageSize: 1 - only the total is
  // needed) whenever a filter that affects counts changes.
  function loadCounts() {
    ["paid", "unpaid", "order"].forEach((view) => {
      api.listSales({ q: historySearch, page: 1, pageSize: 1, view, fromDate, toDate })
        .then((r) => setCounts((c) => ({ ...c, [view]: r.total })))
        .catch(() => {});
    });
  }

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySearch, page, pageSize, historyView, fromDate, toDate]);

  useEffect(() => {
    const t = setTimeout(loadCounts, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySearch, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [historyView, fromDate, toDate, historySearch, pageSize]);

  async function handleMarkPaid(saleId) {
    if (!window.confirm("Are you sure you want to mark this voucher as paid?")) return;
    setHistoryError("");
    try {
      await api.markSalePaid(saleId);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleUndoPaid(saleId) {
    if (!window.confirm("Are you sure you want to unpaid this voucher?")) return;
    setHistoryError("");
    try {
      await api.undoSalePaid(saleId);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleDeliver(saleId) {
    if (!window.confirm("Are you sure you want to mark this order as delivered?")) return;
    setHistoryError("");
    try {
      await api.markSaleDelivered(saleId);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleDeleteSale(saleId) {
    if (!window.confirm("Are you sure you want to delete this voucher? This will restore stock and cannot be undone.")) return;
    setHistoryError("");
    try {
      await api.deleteSale(saleId);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handlePrint(saleId) {
    try {
      const sale = await api.getSale(saleId);
      printSaleVoucher(sale);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleView(saleId) {
    setHistoryError("");
    try {
      const sale = await api.getSale(saleId);
      setViewingSale(sale);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function handleEdit(saleId) {
    setError("");
    setMessage("");
    try {
      const sale = await api.getSale(saleId);
      setEditingSaleId(sale.SaleID);
      setEditingSaleCode(sale.SaleCode);
      setBranchId(sale.BranchID);
      setSaleDate((sale.SaleDate || "").slice(0, 10));
      setPatientId(sale.PatientID);
      setDiscount(Number(sale.Discount) || 0);
      setTax(Number(sale.Tax) || 0);
      setPaid(Number(sale.Paid) || 0);
      setNote(sale.Note || "");
      setItems(
        sale.items.map((d) => ({
          stockId: Number(d.StockCode),
          stockName: d.StockName,
          qty: Number(d.Qty),
          price: Number(d.Price),
        }))
      );
      if (sale.optic) {
        setOptic({
          memberid: sale.optic.memberid || "",
          deliverydate: toDatetimeLocal(sale.optic.deliverydate),
          sphereod: sale.optic.sphereod || "", sphereos: sale.optic.sphereos || "",
          cylinderod: sale.optic.cylinderod || "", cylinderos: sale.optic.cylinderos || "",
          axisod: sale.optic.axisod || "", axisos: sale.optic.axisos || "",
          prismod: sale.optic.prismod || "", prismos: sale.optic.prismos || "",
          pdmm: sale.optic.pdmm || "",
          deliver: sale.optic.status === "deliver",
        });
      } else {
        setOptic(emptyOptic);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCustomerCreated(customer) {
    setCustomers((prev) => [...prev, customer]);
    setPatientId(customer.PatientID);
    setShowAddCustomer(false);
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

  function toggleDeliver(checked) {
    setOptic((o) => ({ ...o, deliver: checked, deliverydate: checked ? o.deliverydate : "" }));
  }

  const selectedCustomer = customers.find((c) => String(c.PatientID) === String(patientId));

  const itemsTotal = items.reduce((sum, i) => sum + Number(i.qty) * Number(i.price), 0);
  const totalAmount = itemsTotal - Number(discount || 0) + Number(tax || 0);
  const leftover = totalAmount - Number(paid || 0);

  function resetForm() {
    setSaleDate(new Date().toISOString().slice(0, 10));
    setPatientId("");
    setItems([]);
    setDiscount(0);
    setTax(0);
    setPaid(0);
    setNote("");
    setOptic(emptyOptic);
    setEditingSaleId(null);
    setEditingSaleCode("");
  }

  async function save() {
    setError("");
    setMessage("");
    if (!patientId) { setError("Please select a customer."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }
    if (optic.deliver && !optic.deliverydate) { setError("Please fill in the Delivery Date, or uncheck \"To be delivered\"."); return; }

    setSaving(true);
    try {
      const body = {
        branchId,
        saleDate,
        patientId,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        paid: Number(paid) || 0,
        note,
        items: items.map((i) => ({ stockId: i.stockId, qty: Number(i.qty), price: Number(i.price) })),
        optic: optic.memberid || optic.deliverydate || optic.sphereod || optic.sphereos
          ? optic : null,
      };
      const result = editingSaleId
        ? await api.updateSale(editingSaleId, body)
        : await api.createSale(body);
      setMessage(`Sale ${result.saleCode} ${editingSaleId ? "updated" : "saved"} - Total ${result.totalAmount.toLocaleString()}, ${result.status}.`);
      resetForm();
      loadHistory();

      if (window.confirm(`Sale ${result.saleCode} saved. Do you want to print the voucher?`)) {
        handlePrint(result.saleId);
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
          <label>Sale Date</label>
          <input type="date" className="sale-date-input" value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)} />
        </div>
        <div className="sale-field sale-field-wide">
          <label>Customer</label>
          <div className="customer-field-row">
            <SearchableSelect
              placeholder="Select a customer..."
              value={patientId}
              onChange={setPatientId}
              onInputChange={setCustomerSearchText}
              noOptionsMessage={() => "No customer found - use \"+ New\" to add one"}
              options={customers.map((c) => ({ value: c.PatientID, label: `${c.PatientName}${c.memberID ? " (Member)" : ""}` }))}
            />
            <button type="button" className="btn-secondary customer-add-btn" onClick={() => setShowAddCustomer(true)}>
              + New
            </button>
          </div>
          {selectedCustomer && (selectedCustomer.PhoneNo || selectedCustomer.Age) && (
            <div className="customer-phone-row">
              <PhoneCallLink phone={selectedCustomer.PhoneNo} />
              {selectedCustomer.Age && <span className="customer-age">Age: {selectedCustomer.Age}</span>}
            </div>
          )}
        </div>
      </div>

      {showAddCustomer && (
        <AddCustomerModal
          initialName={customerSearchText}
          onClose={() => setShowAddCustomer(false)}
          onCreated={handleCustomerCreated}
        />
      )}

      {editingSaleId && (
        <div className="editing-banner">
          Editing sale <strong>{editingSaleCode}</strong>
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
        <div className="sale-optic role-group">
          <h3>Optic Details (optional)</h3>
          <div className="delivery-row">
            <label className="checkbox-label optic-deliver">
              <input type="checkbox" checked={optic.deliver} onChange={(e) => toggleDeliver(e.target.checked)} />
              To be delivered
            </label>
            <label className="optic-delivery-date">
              <span className="field-label-text">
                Delivery Date{optic.deliver && <span className="required-mark"> *</span>}
              </span>
              <input type="datetime-local" disabled={!optic.deliver} value={optic.deliverydate}
                onChange={(e) => setOptic({ ...optic, deliverydate: e.target.value })} />
            </label>
          </div>

          <div className="optic-grid">
            <label>Member ID<input value={optic.memberid} onChange={(e) => setOptic({ ...optic, memberid: e.target.value })} /></label>
            <label>PD (mm)<input value={optic.pdmm} onChange={(e) => setOptic({ ...optic, pdmm: e.target.value })} /></label>

            <label>Sphere OD<input value={optic.sphereod} onChange={(e) => setOptic({ ...optic, sphereod: e.target.value })} /></label>
            <label>Sphere OS<input value={optic.sphereos} onChange={(e) => setOptic({ ...optic, sphereos: e.target.value })} /></label>
            <label>Cylinder OD<input value={optic.cylinderod} onChange={(e) => setOptic({ ...optic, cylinderod: e.target.value })} /></label>
            <label>Cylinder OS<input value={optic.cylinderos} onChange={(e) => setOptic({ ...optic, cylinderos: e.target.value })} /></label>
            <label>Axis OD<input value={optic.axisod} onChange={(e) => setOptic({ ...optic, axisod: e.target.value })} /></label>
            <label>Axis OS<input value={optic.axisos} onChange={(e) => setOptic({ ...optic, axisos: e.target.value })} /></label>
            <label>Prism OD<input value={optic.prismod} onChange={(e) => setOptic({ ...optic, prismod: e.target.value })} /></label>
            <label>Prism OS<input value={optic.prismos} onChange={(e) => setOptic({ ...optic, prismos: e.target.value })} /></label>
          </div>
        </div>

        <div className="sale-summary role-group">
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
            {saving ? "Saving..." : editingSaleId ? "Update Sale" : "Save Sale"}
          </button>
        </div>
      </div>

      <div className="sale-history">
        <h3>Sale List</h3>

        <div className="sale-list-tabs">
          <button className={historyView === "paid" ? "active" : ""} onClick={() => setHistoryView("paid")}>
            Paid{counts.paid !== null ? ` (${counts.paid})` : ""}
          </button>
          <button className={historyView === "unpaid" ? "active" : ""} onClick={() => setHistoryView("unpaid")}>
            Unpaid{counts.unpaid !== null ? ` (${counts.unpaid})` : ""}
          </button>
          <button className={historyView === "order" ? "active" : ""} onClick={() => setHistoryView("order")}>
            To Deliver{counts.order !== null ? ` (${counts.order})` : ""}
          </button>
        </div>

        <div className="sale-list-filters">
          <input className="search-box-input sale-history-search" placeholder="Search sale code or customer..."
            value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />
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
              <th>Date</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Leftover</th>
              {historyView === "order" && <th>Delivery Date</th>}
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.SaleID}>
                <td>{h.SaleCode}</td>
                <td>{h.SaleDate ? h.SaleDate.slice(0, 10) : ""}</td>
                <td>{h.PatientName}</td>
                <td className="num">{Number(h.TotalAmount).toLocaleString()}</td>
                <td className="num">{Number(h.Paid).toLocaleString()}</td>
                <td className="num">{Number(h.LeftOver).toLocaleString()}</td>
                {historyView === "order" && <td>{h.deliverydate ? h.deliverydate.slice(0, 16).replace("T", " ") : ""}</td>}
                <td>{h.Status}</td>
                <td className="sale-actions">
                  <RowActionsMenu
                    actions={[
                      { label: "View", icon: <EyeIcon />, onClick: () => handleView(h.SaleID) },
                      { label: "Edit", icon: <EditIcon />, onClick: () => handleEdit(h.SaleID) },
                      { label: "Print", icon: <PrinterIcon />, onClick: () => handlePrint(h.SaleID) },
                      ...(historyView === "unpaid"
                        ? [{ label: "Mark Paid", icon: <CheckCircleIcon />, onClick: () => handleMarkPaid(h.SaleID) }]
                        : []),
                      ...(historyView === "paid"
                        ? [{ label: "Undo Paid", icon: <UndoIcon />, onClick: () => handleUndoPaid(h.SaleID) }]
                        : []),
                      ...(historyView === "order"
                        ? [{ label: "Mark Delivered", icon: <TruckIcon />, onClick: () => handleDeliver(h.SaleID) }]
                        : []),
                      { label: "Delete", icon: <TrashIcon />, onClick: () => handleDeleteSale(h.SaleID), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {history.length === 0 && !historyLoading && (
              <tr><td colSpan={9} className="muted">No sales found.</td></tr>
            )}
          </tbody>
        </table>
        </div>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {viewingSale && <SaleDetailModal sale={viewingSale} onClose={() => setViewingSale(null)} />}
    </div>
  );
}
