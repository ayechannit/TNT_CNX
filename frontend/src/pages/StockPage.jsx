import { useEffect, useState } from "react";
import { api } from "../api/client";
import PaginationBar from "../components/PaginationBar";
import SearchableSelect from "../components/SearchableSelect";
import SearchBox from "../components/SearchBox";
import PrintBarcodeModal from "../components/PrintBarcodeModal";
import { PrinterIcon } from "../components/icons";
import "./StockPage.css";

const emptyForm = {
  StockID: null,
  CategoryID: "",
  StockCode: "",
  StockName: "",
  StockType: "countable",
  Reorderlevel: "",
  sellprice: "",
  Barcode: "",
  status: "active",
};

function generateBarcode() {
  // Independent of StockCode - a unique numeric code (timestamp tail + random
  // suffix). Kept short (10 digits) on purpose: CODE128 bar count scales with
  // digit count, and the full 13-digit timestamp made labels too dense to
  // scan reliably on small (30x20mm) labels.
  const ts = Date.now() % 1e8; // resets every ~27.8h, fine for same-day item creation
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `${String(ts).padStart(8, "0")}${suffix}`;
}

export default function StockPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState("view"); // view | add | edit
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printingItem, setPrintingItem] = useState(null);
  // The barcode actually saved in the database for the selected row - kept
  // separate from form.Barcode, which may hold a freshly-generated draft
  // value that hasn't been saved yet and so can't be printed (it wouldn't
  // scan to anything if the user forgot to hit Edit -> Save first).
  const [selectedBarcode, setSelectedBarcode] = useState("");

  async function loadStock() {
    setLoading(true);
    try {
      const result = await api.searchStock({
        q: search,
        categoryId: categoryFilter,
        status: statusFilter,
        page,
        pageSize,
      });
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
    api.getCategories().then(setCategories).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadStock(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter, pageSize]);

  function startNew() {
    setForm({ ...emptyForm, CategoryID: categories[0]?.CategoryID || "" });
    setSelectedBarcode("");
    setMode("add");
    setError("");
  }

  function selectRow(row) {
    if (mode !== "view") return;
    const needsBarcode = !row.Barcode;
    setForm({
      StockID: row.StockID,
      CategoryID: row.CategoryID,
      StockCode: row.StockCode,
      StockName: row.StockName,
      StockType: row.StockType,
      Reorderlevel: row.Reorderlevel,
      sellprice: row.sellprice,
      Barcode: needsBarcode ? generateBarcode() : row.Barcode,
      status: row.status,
    });
    setSelectedBarcode(row.Barcode || "");
  }

  function startEdit() {
    if (!form.StockID) return;
    setMode("edit");
    setError("");
  }

  function cancel() {
    setForm(emptyForm);
    setSelectedBarcode("");
    setMode("view");
    setError("");
  }

  function handleGenerateBarcode() {
    setForm((f) => ({ ...f, Barcode: generateBarcode() }));
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      const wasAdd = mode === "add";
      if (wasAdd) {
        await api.createStock(form);
      } else if (mode === "edit") {
        await api.updateStock(form.StockID, form);
      }
      const savedForm = form;
      setForm(emptyForm);
      setSelectedBarcode("");
      setMode("view");
      loadStock();
      if (wasAdd && savedForm.Barcode && window.confirm("Item saved. Print the barcode label now?")) {
        setPrintingItem(savedForm);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const readOnly = mode === "view";

  return (
    <div className="stock-page">
      <div className="stock-list">
        <div className="filter-row">
          <SearchBox
            placeholder="Search by name, code, or barcode..."
            value={search}
            onChange={setSearch}
          />
          <div className="filter-select">
            <SearchableSelect
              placeholder="All Categories"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categories.map((c) => ({ value: c.CategoryID, label: c.CategoryName }))}
            />
          </div>
          <div className="filter-select filter-select-narrow">
            <SearchableSelect
              placeholder="All Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Category</th>
              <th>Name</th>
              <th>Type</th>
              <th>Price</th>
              <th>Barcode</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.StockID}
                className={form.StockID === row.StockID ? "selected" : ""}
                onClick={() => selectRow(row)}
              >
                <td>{row.StockCode}</td>
                <td>{row.CategoryName}</td>
                <td>{row.StockName}</td>
                <td>{row.StockType}</td>
                <td className="num">{Number(row.sellprice).toLocaleString()}</td>
                <td>{row.Barcode || <span className="muted">none</span>}</td>
                <td>
                  {row.Barcode && (
                    <button
                      className="row-icon-btn"
                      title="Print barcode"
                      onClick={(e) => { e.stopPropagation(); setPrintingItem(row); }}
                    >
                      <PrinterIcon />
                    </button>
                  )}
                </td>
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
          <button className="btn-secondary" onClick={startEdit} disabled={mode !== "view" || !form.StockID}>Edit</button>
          <button className="btn-primary" onClick={save} disabled={mode === "view" || saving}>{saving ? "Saving..." : "Save"}</button>
          <button className="btn-secondary" onClick={cancel} disabled={mode === "view"}>Cancel</button>
        </div>

        {error && <div className="error">{error}</div>}

        <label>Category</label>
        <SearchableSelect
          isDisabled={readOnly}
          value={form.CategoryID}
          onChange={(v) => setForm({ ...form, CategoryID: v })}
          options={categories.map((c) => ({ value: c.CategoryID, label: c.CategoryName }))}
          isClearable={false}
        />

        <label>Stock Code</label>
        <input disabled={readOnly} value={form.StockCode}
          onChange={(e) => setForm({ ...form, StockCode: e.target.value })} />

        <label>Stock Name</label>
        <input disabled={readOnly} value={form.StockName}
          onChange={(e) => setForm({ ...form, StockName: e.target.value })} />

        <label>Type</label>
        <div className="radio-row">
          <label>
            <input type="radio" disabled={readOnly} checked={form.StockType === "countable"}
              onChange={() => setForm({ ...form, StockType: "countable" })} /> Countable
          </label>
          <label>
            <input type="radio" disabled={readOnly} checked={form.StockType === "uncountable"}
              onChange={() => setForm({ ...form, StockType: "uncountable" })} /> Uncountable
          </label>
        </div>

        <label>Reorder Level</label>
        <input disabled={readOnly} type="number" value={form.Reorderlevel}
          onChange={(e) => setForm({ ...form, Reorderlevel: e.target.value })} />

        <label>Sell Price</label>
        <input disabled={readOnly} type="number" value={form.sellprice}
          onChange={(e) => setForm({ ...form, sellprice: e.target.value })} />

        <label>Barcode</label>
        <div className="barcode-row">
          <input disabled={readOnly} value={form.Barcode}
            onChange={(e) => setForm({ ...form, Barcode: e.target.value })} />
          <button className="btn-secondary" disabled={readOnly} onClick={handleGenerateBarcode}>Generate</button>
          <button
            className="btn-secondary"
            disabled={!selectedBarcode}
            title={selectedBarcode ? "" : "Save this item first - a generated barcode can't be printed until it's saved"}
            onClick={() => setPrintingItem({ ...form, Barcode: selectedBarcode })}
          >
            Print
          </button>
        </div>

        <label className="checkbox-label">
          <input type="checkbox" disabled={readOnly} checked={form.status === "active"}
            onChange={(e) => setForm({ ...form, status: e.target.checked ? "active" : "inactive" })} />
          {" "}Active
        </label>
      </div>

      {printingItem && <PrintBarcodeModal item={printingItem} onClose={() => setPrintingItem(null)} />}
    </div>
  );
}
