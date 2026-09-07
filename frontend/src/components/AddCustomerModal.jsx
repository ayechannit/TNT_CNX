import { useState } from "react";
import { api } from "../api/client";
import "./SaleDetailModal.css";

function generateMemberId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Quick "new customer" form used from the Sale screen when a search for an
 * existing customer comes up empty. Mirrors CustomerPage's fields, but
 * returns the created customer directly instead of navigating away.
 */
export default function AddCustomerModal({ initialName = "", onClose, onCreated }) {
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [memberID, setMemberID] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleMember(checked) {
    setIsMember(checked);
    if (checked && !memberID) setMemberID(generateMemberId());
  }

  async function save() {
    setError("");
    if (!name.trim()) { setError("Please enter the customer's name."); return; }
    setSaving(true);
    try {
      const body = {
        PatientName: name.trim(),
        Age: age || null,
        PhoneNo: phone || null,
        memberID: isMember ? memberID : null,
      };
      const result = await api.createEntity("customers", body);
      onCreated({ PatientID: result.PatientID, PatientName: body.PatientName, memberID: body.memberID });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Customer</h2>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="summary-field">
          <label>Customer Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()} />
        </div>
        <div className="summary-field">
          <label>Age</label>
          <input value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="summary-field">
          <label>Phone No</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="member-toggle">
          <label className="switch">
            <input type="checkbox" checked={isMember} onChange={(e) => toggleMember(e.target.checked)} />
            <span className="switch-slider" />
          </label>
          <span className="member-toggle-label">Member</span>
          {isMember && <span className="member-id-badge">{memberID}</span>}
        </div>

        <div className="button-row">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
