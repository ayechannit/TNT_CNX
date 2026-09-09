import { useEffect, useState } from "react";
import { api } from "../api/client";
import PaginationBar from "../components/PaginationBar";
import SearchBox from "../components/SearchBox";
import PhoneCallLink from "../components/PhoneCallLink";
import "./StockPage.css";

const emptyForm = {
  PatientID: null,
  PatientName: "",
  Age: "",
  PhoneNo: "",
  memberID: "",
  isMember: false,
};

function generateMemberId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function CustomerPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState("view");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await api.listEntity("customers", { q: search, page, pageSize });
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
  }, [search, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  function startNew() {
    setForm(emptyForm);
    setMode("add");
    setError("");
  }

  function selectRow(row) {
    if (mode !== "view") return;
    setForm({
      PatientID: row.PatientID,
      PatientName: row.PatientName,
      Age: row.Age,
      PhoneNo: row.PhoneNo,
      memberID: row.memberID || "",
      isMember: !!row.memberID,
    });
  }

  function startEdit() {
    if (!form.PatientID) return;
    setMode("edit");
    setError("");
  }

  function cancel() {
    setForm(emptyForm);
    setMode("view");
    setError("");
  }

  function toggleMember(checked) {
    setForm((f) => ({
      ...f,
      isMember: checked,
      // Keep the existing memberID around while unchecked, so re-checking
      // restores it instead of generating a new one. Only generate fresh
      // when there was never one to begin with.
      memberID: checked && !f.memberID ? generateMemberId() : f.memberID,
    }));
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      const body = {
        PatientName: form.PatientName,
        Age: form.Age,
        PhoneNo: form.PhoneNo,
        memberID: form.isMember ? form.memberID : null,
      };
      if (mode === "add") {
        await api.createEntity("customers", body);
      } else if (mode === "edit") {
        await api.updateEntity("customers", form.PatientID, body);
      }
      setForm(emptyForm);
      setMode("view");
      load();
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
            placeholder="Search by name, phone, or member ID..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Phone</th>
              <th>Member ID</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.PatientID}
                className={form.PatientID === row.PatientID ? "selected" : ""}
                onClick={() => selectRow(row)}
              >
                <td>{row.PatientName}</td>
                <td>{row.Age}</td>
                <td>{row.PhoneNo ? <PhoneCallLink phone={row.PhoneNo} /> : <span className="muted">-</span>}</td>
                <td>{row.memberID || <span className="muted">not a member</span>}</td>
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
          <button className="btn-secondary" onClick={startEdit} disabled={mode !== "view" || !form.PatientID}>Edit</button>
          <button className="btn-primary" onClick={save} disabled={mode === "view" || saving}>{saving ? "Saving..." : "Save"}</button>
          <button className="btn-secondary" onClick={cancel} disabled={mode === "view"}>Cancel</button>
        </div>

        {error && <div className="error">{error}</div>}

        <label>Customer Name</label>
        <input disabled={readOnly} value={form.PatientName}
          onChange={(e) => setForm({ ...form, PatientName: e.target.value })} />

        <label>Age</label>
        <input disabled={readOnly} value={form.Age}
          onChange={(e) => setForm({ ...form, Age: e.target.value })} />

        <label>Phone No</label>
        <input disabled={readOnly} value={form.PhoneNo}
          onChange={(e) => setForm({ ...form, PhoneNo: e.target.value })} />

        <div className="member-toggle">
          <label className="switch">
            <input type="checkbox" disabled={readOnly} checked={form.isMember}
              onChange={(e) => toggleMember(e.target.checked)} />
            <span className="switch-slider" />
          </label>
          <span className="member-toggle-label">Member</span>
          {form.isMember && <span className="member-id-badge">{form.memberID}</span>}
        </div>
      </div>
    </div>
  );
}
