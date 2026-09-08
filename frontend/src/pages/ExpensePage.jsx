import { useEffect, useState } from "react";
import { api } from "../api/client";
import SearchableSelect from "../components/SearchableSelect";
import PaginationBar from "../components/PaginationBar";
import SearchBox from "../components/SearchBox";
import RowActionsMenu from "../components/RowActionsMenu";
import { EditIcon, TrashIcon } from "../components/icons";
import "./StockPage.css";
import "./UserRolePage.css";
import "./SalePage.css";
import "./ExpensePage.css";

const emptyForm = {
  expenseid: null,
  expensetypeid: "",
  expensedate: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
};

export default function ExpensePage() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
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
    api.listEntity("expense-types", { status: "active", pageSize: 1000 })
      .then((r) => setExpenseTypes(r.data))
      .catch((e) => setError(e.message));
  }, []);

  function loadHistory() {
    api.listExpenses({ q: search, branchId, page, pageSize, fromDate, toDate }).then((r) => {
      setHistory(r.data);
      setTotalPages(r.totalPages);
      setTotal(r.total);
    }).catch((e) => setHistoryError(e.message));
  }

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branchId, page, pageSize, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [search, branchId, fromDate, toDate, pageSize]);

  function resetForm() {
    setForm(emptyForm);
  }

  function editRow(row) {
    setError("");
    setMessage("");
    setForm({
      expenseid: row.expenseid,
      expensetypeid: row.expensetypeid,
      expensedate: row.expensedate ? row.expensedate.slice(0, 10) : "",
      description: row.description,
      amount: row.amount,
    });
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    setHistoryError("");
    try {
      await api.deleteExpense(id);
      loadHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  async function save() {
    setError("");
    setMessage("");
    if (!branchId) { setError("Please select a branch."); return; }
    if (!form.expensetypeid) { setError("Please select an expense type."); return; }
    if (!form.description.trim()) { setError("Description can not be blank."); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError("Amount can not be blank."); return; }

    setSaving(true);
    try {
      const body = {
        expensetypeid: form.expensetypeid,
        expensedate: form.expensedate,
        description: form.description,
        amount: Number(form.amount),
        branchid: branchId,
        user: "web",
      };
      if (form.expenseid) {
        await api.updateExpense(form.expenseid, body);
        setMessage("Expense updated.");
      } else {
        await api.createExpense(body);
        setMessage("Expense saved.");
      }
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
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="role-success">{message}</div>}

      <div className="expense-form">
        <h3>{form.expenseid ? "Edit Expense" : "New Expense"}</h3>

        <label>Expense Type</label>
        <SearchableSelect
          placeholder="Select an expense type..."
          value={form.expensetypeid}
          onChange={(v) => setForm({ ...form, expensetypeid: v })}
          options={expenseTypes.map((t) => ({ value: t.expensetypeid, label: t.expensetype }))}
          isClearable={false}
        />

        <label>Date</label>
        <input type="date" className="sale-date-input" value={form.expensedate}
          onChange={(e) => setForm({ ...form, expensedate: e.target.value })} />

        <label>Description</label>
        <input value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <label>Amount</label>
        <input type="number" value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })} />

        <div className="button-row" style={{ marginTop: 16, borderBottom: "none", paddingBottom: 0 }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : form.expenseid ? "Update" : "Save"}
          </button>
          {form.expenseid && (
            <button className="btn-secondary" onClick={resetForm}>Cancel</button>
          )}
        </div>
      </div>

      <div className="sale-history">
        <h3>Expense List</h3>

        <div className="sale-list-filters">
          <SearchBox placeholder="Search expense type or description..." value={search} onChange={setSearch} />
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
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.expenseid}>
                <td>{h.expensedate ? h.expensedate.slice(0, 10) : ""}</td>
                <td>{h.expensetype}</td>
                <td>{h.description}</td>
                <td className="num">{Number(h.amount).toLocaleString()}</td>
                <td>{h.createuser}</td>
                <td className="sale-actions">
                  <RowActionsMenu
                    actions={[
                      { label: "Edit", icon: <EditIcon />, onClick: () => editRow(h) },
                      { label: "Delete", icon: <TrashIcon />, onClick: () => handleDelete(h.expenseid), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={6} className="muted">No expenses found.</td></tr>
            )}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
}
