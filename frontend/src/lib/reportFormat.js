// Shared formatting/grouping logic for report display, used by both the
// on-screen results table (ReportsPage) and the print output (printReport).
const COMPUTES = {
  qtyPrice: (row) => (Number(row.Qty) || 0) * (Number(row.Price) || 0),
};

export function isNumericType(col) {
  return col.type === "number" || col.type === "int";
}

export function computeValue(col, row) {
  if (col.compute) return COMPUTES[col.compute] ? COMPUTES[col.compute](row) : "";
  return row[col.field];
}

// Returns a plain display string (no HTML escaping) for a cell.
export function formatValue(col, row) {
  const v = computeValue(col, row);
  if (v === null || v === undefined || v === "") return "";
  if (col.type === "date") {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  if (col.type === "number") {
    const n = Number(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (col.type === "int") {
    const n = Number(v);
    if (isNaN(n)) return String(v);
    return Math.round(n).toLocaleString();
  }
  return String(v);
}

export function formatSum(n, type) {
  if (type === "int") return Math.round(n).toLocaleString();
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatSignedSum(n) {
  const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}

export function sumFields(rows, fields) {
  const out = {};
  fields.forEach((f) => {
    out[f] = rows.reduce((s, r) => s + (Number(r[f]) || 0), 0);
  });
  return out;
}

export function groupRowsBy(rows, field) {
  const groups = [];
  let current = null;
  for (const r of rows) {
    const val = r[field];
    if (!current || current.value !== val) {
      current = { value: val, rows: [] };
      groups.push(current);
    }
    current.rows.push(r);
  }
  return groups;
}
