const REPORT_PRINT_STYLES = `
  @page { size: A4 landscape; margin: 12mm; }
  html, body { margin: 0; padding: 0; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body { font-family: 'Segoe UI', sans-serif; color: #1a1a1a; }
  .report-print-title { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
  .report-print-meta { font-size: 10px; color: #444; margin-bottom: 10px; }
  .report-print-meta span { margin-right: 18px; }
  .report-print-meta b { color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 6px; border-bottom: 1px solid #ddd; font-size: 10px; text-align: left; }
  th { font-size: 9px; text-transform: uppercase; color: #555; border-bottom: 2px solid #333; }
  td.num { text-align: right; }
`;

function escapeHtml(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function printReportTable({ title, filters = [], columns, rows }) {
  const filtersHtml = filters
    .filter((f) => f.value !== "" && f.value !== null && f.value !== undefined)
    .map((f) => `<span><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`)
    .join("");

  const headHtml = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const bodyHtml = rows
    .map((r) => {
      const cells = columns
        .map((c) => {
          const v = r[c];
          const isNumeric = v !== null && v !== "" && typeof v !== "boolean" && !isNaN(Number(v));
          return `<td class="${isNumeric ? "num" : ""}">${escapeHtml(v)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <style>${REPORT_PRINT_STYLES}</style>
    </head>
    <body>
      <div class="report-print-title">${escapeHtml(title)}</div>
      <div class="report-print-meta">
        ${filtersHtml}
        <span><b>Printed</b> ${new Date().toLocaleString()}</span>
        <span><b>Rows</b> ${rows.length}</span>
      </div>
      <table>
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml || `<tr><td colspan="${columns.length}">No data for the selected filters.</td></tr>`}</tbody>
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
}
