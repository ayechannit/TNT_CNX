import { useEffect, useState } from "react";
import { api } from "../api/client";
import SearchableSelect from "../components/SearchableSelect";
import "./StockPage.css";
import "./UserRolePage.css";

const SCREEN_PERMISSIONS = [
  { key: "FrmSale", label: "Sale" },
  { key: "FrmSaleList", label: "Sale List" },
  { key: "FrmSaleReturn", label: "Sale Return" },
  { key: "FrmSaleReturnList", label: "Sale Return List" },
  { key: "FrmPurchase", label: "Purchase" },
  { key: "FrmPurchaseList", label: "Purchase List" },
  { key: "FrmReturn", label: "Return" },
  { key: "FrmReturnList", label: "Return List" },
  { key: "FrmStock", label: "Stock" },
  { key: "FrmStockAdjust", label: "Stock Adjustment" },
  { key: "FrmStockBalance", label: "Stock Balance" },
  { key: "FrmTransfer", label: "Transfer" },
  { key: "FrmTransferList", label: "Transfer List" },
  { key: "FrmUser", label: "User Management" },
  { key: "FrmUserRole", label: "User Roles" },
  { key: "FrmReport", label: "Reports" },
];

const REPORT_PERMISSIONS = [
  { key: "FrmSaleReport", label: "Sale Report" },
  { key: "FrmPurchaseReport", label: "Purchase Report" },
];

const OTHER_PERMISSIONS = [
  { key: "Delete", label: "Allow Delete" },
  { key: "EditSale", label: "Edit Sale Voucher" },
  { key: "FrmSaleDebit", label: "Sale Debit" },
  { key: "DisableSaleDate", label: "Disable changing sale date" },
  { key: "dtpSale", label: "Sale date picker enabled" },
  { key: "dtpPurchase", label: "Purchase date picker enabled" },
  { key: "enableUnpaid", label: "Enable unpaid sales" },
];

export default function UserRolePage() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [userId, setUserId] = useState("");
  const [checked, setChecked] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.listEntity("users", { pageSize: 1000 }).then((r) => setUsers(r.data)).catch((e) => setError(e.message));
    api.listEntity("branches", { pageSize: 1000 }).then((r) => setBranches(r.data)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!userId) {
      setChecked(new Set());
      return;
    }
    setLoading(true);
    setMessage("");
    api
      .getUserRoles(userId)
      .then((formnames) => setChecked(new Set(formnames)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  function toggle(key) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await api.setUserRoles(userId, Array.from(checked));
      setMessage("Permissions saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderGroup(title, items) {
    if (items.length === 0) return null;
    return (
      <div className="role-group" key={title}>
        <h3>{title}</h3>
        <div className="role-grid">
          {items.map((p) => (
            <label key={p.key} className="role-checkbox">
              <input type="checkbox" checked={checked.has(p.key)} onChange={() => toggle(p.key)} />
              {p.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="user-role-page">
      <div className="role-user-picker">
        <label>User</label>
        <SearchableSelect
          placeholder="Select a user..."
          value={userId}
          onChange={setUserId}
          options={users.map((u) => ({ value: u.UserID, label: `${u.RealName} (${u.UserName})` }))}
          isClearable={false}
        />
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="role-success">{message}</div>}

      {userId && loading && <div className="muted">Loading permissions...</div>}

      {userId && !loading && (
        <>
          {renderGroup("Screens", SCREEN_PERMISSIONS)}
          {renderGroup("Reports", REPORT_PERMISSIONS)}
          {renderGroup("Other Permissions", OTHER_PERMISSIONS)}
          {renderGroup("Branch Access", branches.map((b) => ({ key: `B_${b.id}`, label: b.branchname })))}

          <button className="btn-primary role-save" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Permissions"}
          </button>
        </>
      )}
    </div>
  );
}
