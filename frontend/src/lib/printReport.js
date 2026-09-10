import { isNumericType, formatValue, formatSum, formatSignedSum, sumFields, groupRowsBy } from "./reportFormat";

function pageCss(orientation) {
  return `
  @page { size: A4 ${orientation}; margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body { font-family: 'Segoe UI', sans-serif; color: #1a1a1a; }
  .report-print-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
  .report-print-company { font-size: 15px; font-weight: 700; }
  .report-print-title { font-size: 15px; font-weight: 700; text-decoration: underline; }
  .report-print-meta { font-size: 10px; color: #444; margin-bottom: 10px; }
  .report-print-meta span { margin-right: 18px; }
  .report-print-meta b { color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 6px; border-bottom: 1px solid #ddd; font-size: 10px; text-align: left; }
  th { font-size: 9px; text-transform: uppercase; color: #555; border-bottom: 2px solid #333; }
  td.num, th.num { text-align: right; }
  tr.group-header td { background: #f0f0f0; font-weight: 700; border-bottom: 1px solid #333; }
  tr.subtotal-row td { font-weight: 700; border-top: 1px solid #999; border-bottom: 1px solid #999; }
  tr.grand-total-row td { font-weight: 700; border-top: 2px solid #333; border-bottom: 2px solid #333; }
  td.total-label { text-align: right; }
  .statement { max-width: 520px; }
  .statement-section { font-weight: 700; font-size: 12px; margin: 14px 0 4px; border-bottom: 2px solid #333; padding-bottom: 2px; }
  .statement-line { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
  .statement-line.bold { font-weight: 700; border-top: 1px solid #999; margin-top: 2px; padding-top: 4px; }
  .statement-line.big { font-size: 14px; border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 6px 0; margin-top: 8px; }
  .statement-value { font-variant-numeric: tabular-nums; }
`;
}

function escapeHtml(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function rowHtml(columns, row) {
  const cells = columns.map((c) => `<td class="${isNumericType(c) ? "num" : ""}">${escapeHtml(formatValue(c, row))}</td>`).join("");
  return `<tr>${cells}</tr>`;
}

function totalRowHtml(columns, label, sumsByField, rowClass) {
  const totalFields = Object.keys(sumsByField);
  const firstTotalIdx = columns.findIndex((c) => totalFields.includes(c.field));
  const labelColspan = firstTotalIdx === -1 ? columns.length : firstTotalIdx;
  let html = `<tr class="${rowClass}"><td colspan="${labelColspan}" class="total-label">${escapeHtml(label)}</td>`;
  for (let i = labelColspan; i < columns.length; i++) {
    const c = columns[i];
    if (totalFields.includes(c.field)) {
      html += `<td class="num">${escapeHtml(formatSum(sumsByField[c.field], c.type))}</td>`;
    } else {
      html += `<td></td>`;
    }
  }
  html += `</tr>`;
  return html;
}

export function printReportTable({ title, orientation = "portrait", filters = [], columns, rows, group, totals, companyName = "The New Trend" }) {
  const cols = columns && columns.length > 0 ? columns : [];
  const usingCustomColumns = cols.length > 0;

  const filtersHtml = filters
    .filter((f) => f.value !== "" && f.value !== null && f.value !== undefined)
    .map((f) => `<span><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`)
    .join("");

  const headHtml = cols.map((c) => `<th class="${isNumericType(c) ? "num" : ""}">${escapeHtml(c.header)}</th>`).join("");

  let bodyHtml;
  if (!rows || rows.length === 0) {
    bodyHtml = `<tr><td colspan="${cols.length || 1}">No data for the selected filters.</td></tr>`;
  } else if (group) {
    const groups = groupRowsBy(rows, group.field);
    bodyHtml = groups
      .map((g) => {
        let s = `<tr class="group-header"><td colspan="${cols.length}">${escapeHtml(g.value ?? "")}</td></tr>`;
        s += g.rows.map((r) => rowHtml(cols, r)).join("");
        if (group.subtotalColumns && group.subtotalColumns.length > 0) {
          s += totalRowHtml(cols, group.subtotalLabel || "Subtotal", sumFields(g.rows, group.subtotalColumns), "subtotal-row");
        }
        return s;
      })
      .join("");
  } else {
    bodyHtml = rows.map((r) => rowHtml(cols, r)).join("");
  }

  if (totals && totals.length > 0 && rows && rows.length > 0) {
    bodyHtml += totalRowHtml(cols, "Total", sumFields(rows, totals), "grand-total-row");
  }

  const html = `
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <style>${pageCss(orientation)}</style>
    </head>
    <body>
      <div class="report-print-head">
        <div class="report-print-company">${escapeHtml(companyName)}</div>
        <div class="report-print-title">${escapeHtml(title)}</div>
      </div>
      <div class="report-print-meta">
        ${filtersHtml}
        <span><b>Printed</b> ${new Date().toLocaleString()}</span>
        <span><b>Rows</b> ${rows ? rows.length : 0}</span>
      </div>
      <table>
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => win.print();

  return usingCustomColumns;
}

export function printStatementReport({ title, orientation = "portrait", filters = [], lines, row, companyName = "The New Trend" }) {
  const filtersHtml = filters
    .filter((f) => f.value !== "" && f.value !== null && f.value !== undefined)
    .map((f) => `<span><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`)
    .join("");

  const bodyHtml = lines
    .map((line) => {
      if (line.section) {
        return `<div class="statement-section">${escapeHtml(line.section)}</div>`;
      }
      const classes = ["statement-line"];
      if (line.bold) classes.push("bold");
      if (line.big) classes.push("big");
      const value = row ? row[line.field] : 0;
      return `<div class="${classes.join(" ")}"><span>${escapeHtml(line.label)}</span><span class="statement-value">${escapeHtml(formatSignedSum(Number(value) || 0))}</span></div>`;
    })
    .join("");

  const html = `
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <style>${pageCss(orientation)}</style>
    </head>
    <body>
      <div class="report-print-head">
        <div class="report-print-company">${escapeHtml(companyName)}</div>
        <div class="report-print-title">${escapeHtml(title)}</div>
      </div>
      <div class="report-print-meta">
        ${filtersHtml}
        <span><b>Printed</b> ${new Date().toLocaleString()}</span>
      </div>
      <div class="statement">${bodyHtml}</div>
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=700,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => win.print();
}
