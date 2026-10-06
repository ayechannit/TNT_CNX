import voucherBg from "../assets/tnt-voucher-bg.png";

// Base (unscaled) type sizes/paddings for the printable area - see
// voucherStylesCss() below for why these are parameterized instead of
// baked into a fixed stylesheet string.
const BASE = {
  contentPad: [8, 10],
  title: 13,
  titleMarginBottom: 4,
  meta: 9,
  metaMarginBottom: 8,
  tableMarginBottom: 8,
  cellPad: [3, 4],
  cell: 9,
  th: 8,
  totals: 9,
  totalsRowPad: 2,
  totalsGrand: 11,
  totalsGrandMarginTop: 3,
  totalsGrandPadTop: 4,
  opticMarginTop: 8,
  optic: 8.5,
  opticPad: [2, 4],
  // sale voucher (optic slip) layout
  slipInfo: 9.5,
  slipInfoRowPad: 2,
  slipGap: 6,
  slipRx: 9.5,
  slipRxPad: [3, 5],
  slipItem: 9,
  slipItemPad: [2, 4],
  slipSum: 9.5,
  slipSumPad: [2, 5],
};

// A5 page with a real 5mm margin, not 0 - printers can't physically mark
// right up to the paper edge (hardware unprintable margin, commonly
// 3-5mm) regardless of what @page margin requests, and the voucher
// background's footer/address band sits close enough to the bottom edge
// that a 0 margin let it get silently clipped by the printer. Shrinking
// the voucher-page to fit inside a real margin keeps everything,
// including the footer, inside the area the printer can actually mark.
//
// scale (<=1) shrinks all type sizes/paddings proportionally - used to fit
// a voucher with enough items to overflow the fixed-height content box.
// Font-size/padding are used rather than a CSS transform: scale() because
// Chrome's print/PDF pipeline silently ignores `transform` on paginated
// output (verified - it renders at full, untransformed size), so a
// transform-based fit would print exactly as broken as no fit at all.
function voucherStylesCss(scale = 1) {
  const px = (n) => `${(n * scale).toFixed(2)}px`;
  return `
    @page { size: A5; margin: 5mm; }
    html, body { margin: 0; padding: 0; }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body { font-family: 'Segoe UI', sans-serif; color: #1a1a1a; }
    .voucher-page {
      position: relative;
      width: 138mm;
      height: 200mm;
      background-image: url(${voucherBg});
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }
    .voucher-content {
      position: absolute;
      top: 19%;
      left: 4%;
      right: 4%;
      bottom: 8%;
      overflow: hidden;
      padding: ${px(BASE.contentPad[0])} ${px(BASE.contentPad[1])};
      box-sizing: border-box;
    }
    .voucher-title { font-size: ${px(BASE.title)}; font-weight: 700; margin: 0 0 ${px(BASE.titleMarginBottom)}; }
    .voucher-meta { font-size: ${px(BASE.meta)}; color: #444; margin-bottom: ${px(BASE.metaMarginBottom)}; }
    .voucher-meta b { color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: ${px(BASE.tableMarginBottom)}; }
    th, td { padding: ${px(BASE.cellPad[0])} ${px(BASE.cellPad[1])}; border-bottom: 1px solid #ddd; font-size: ${px(BASE.cell)}; text-align: left; }
    th { font-size: ${px(BASE.th)}; text-transform: uppercase; color: #555; }
    .totals { width: 55%; margin-left: auto; font-size: ${px(BASE.totals)}; }
    .totals div { display: flex; justify-content: space-between; padding: ${px(BASE.totalsRowPad)} 0; }
    .totals .grand { font-weight: 700; font-size: ${px(BASE.totalsGrand)}; border-top: 1px solid #333; margin-top: ${px(BASE.totalsGrandMarginTop)}; padding-top: ${px(BASE.totalsGrandPadTop)}; }
    .optic-box { margin-top: ${px(BASE.opticMarginTop)}; font-size: ${px(BASE.optic)}; }
    .optic-box table td { font-size: ${px(BASE.optic)}; padding: ${px(BASE.opticPad[0])} ${px(BASE.opticPad[1])}; }

    /* Sale voucher - laid out like the legacy R_OpticSlip report. */
    .slip-info { width: 100%; margin-bottom: ${px(BASE.slipGap)}; border-bottom: 1.5px solid #222; }
    .slip-info td { border: 0; padding: ${px(BASE.slipInfoRowPad)} ${px(BASE.cellPad[1])}; font-size: ${px(BASE.slipInfo)}; vertical-align: top; }
    .slip-info .lbl { color: #555; white-space: nowrap; width: 1%; text-align: right; font-family: Georgia, 'Times New Roman', serif; }
    .slip-rx { display: flex; gap: ${px(BASE.slipGap * 2)}; margin-bottom: ${px(BASE.slipGap)}; }
    .slip-rx table { margin: 0; flex: 1; }
    .slip-rx th, .slip-rx td { border: 1px solid #222; font-size: ${px(BASE.slipRx)}; padding: ${px(BASE.slipRxPad[0])} ${px(BASE.slipRxPad[1])}; text-align: center; text-transform: none; color: #1a1a1a; }
    .slip-rx th { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; }
    .slip-rx td.rx-lbl { text-align: left; font-family: Georgia, 'Times New Roman', serif; font-weight: 700; }
    .slip-rx .blank { border: 0; }
    .slip-items { margin-bottom: 0; }
    .slip-items th, .slip-items td { border: 1px solid #222; border-top: 0; border-bottom: 0; font-size: ${px(BASE.slipItem)}; padding: ${px(BASE.slipItemPad[0])} ${px(BASE.slipItemPad[1])}; vertical-align: top; }
    .slip-items thead th { border: 1px solid #222; text-align: center; text-transform: none; color: #1a1a1a; font-family: Georgia, 'Times New Roman', serif; }
    .slip-items tbody tr:last-child td { border-bottom: 1px solid #222; }
    .slip-items .c { text-align: center; }
    .slip-items .r { text-align: right; }
    .slip-bottom { display: flex; gap: ${px(BASE.slipGap * 2)}; margin-top: ${px(BASE.slipGap)}; }
    .slip-notes { flex: 1; font-size: ${px(BASE.slipInfo)}; }
    .slip-notes .lbl { color: #555; }
    .slip-notes > div { margin-bottom: ${px(BASE.slipGap)}; }
    .slip-notes .remark { padding-left: ${px(BASE.slipGap * 3)}; white-space: pre-wrap; }
    .slip-sum { width: 52%; margin: 0; border-collapse: separate; border-spacing: 0 ${px(2)}; }
    .slip-sum td { border: 1px solid #222; font-size: ${px(BASE.slipSum)}; padding: ${px(BASE.slipSumPad[0])} ${px(BASE.slipSumPad[1])}; }
    .slip-sum td:first-child { text-align: right; font-weight: 700; font-family: Georgia, 'Times New Roman', serif; border-right: 0; width: 55%; }
    .slip-sum td:last-child { text-align: right; }
    .slip-sum tr.net td { font-size: ${px(BASE.slipSum * 1.1)}; }
  `;
}

function pageHtml(title, css, bodyHtml) {
  return `
    <html>
    <head>
      <title>${title}</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="voucher-page">
        <div class="voucher-content">${bodyHtml}</div>
      </div>
    </body>
    </html>
  `;
}

function measureHeights(css, bodyHtml) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed; left:-9999px; top:0; width:0; height:0; border:0; visibility:hidden;";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      iframe.remove();
      resolve(result);
    };
    iframe.onload = () => {
      try {
        const content = iframe.contentDocument.querySelector(".voucher-content");
        finish({ available: content.clientHeight, natural: content.scrollHeight });
      } catch {
        finish(null);
      }
    };
    // Belt-and-braces timeout in case onload never fires for some reason -
    // better to print at full size (worst case, a long voucher gets
    // clipped as before) than to never print at all.
    setTimeout(() => finish(null), 2000);
    // srcdoc has to be set *before* the iframe is attached to the
    // document - an iframe fires its own "load" for the empty document it
    // starts with the instant it's inserted, and that fires before srcdoc
    // gets a chance to load, so onload (a single-slot handler, not
    // addEventListener) would fire for the wrong, still-empty document and
    // measure a height of 0 every time.
    iframe.srcdoc = pageHtml("", css, bodyHtml);
    document.body.appendChild(iframe);
  });
}

// Measured in a hidden iframe *before* opening the print window (rather
// than in a script inside the print window itself), which sidesteps a
// real timing hazard: some print pipelines capture the page before a
// script attached to the popup's own "load" event gets to run, so any
// resizing done there can silently be ignored. Pre-computing the fitted
// stylesheet and handing it directly to the print window has no such race.
//
// Shrinking the font-size reflows the text (possibly changing line
// wrapping), so one pass isn't guaranteed to land exactly on the
// available height - a few passes converge on a close fit without ever
// needing to be exact, since voucher-content still clips as a backstop.
async function computeFittedCss(bodyHtml) {
  let scale = 1;
  for (let pass = 0; pass < 4; pass++) {
    const heights = await measureHeights(voucherStylesCss(scale), bodyHtml);
    if (!heights || heights.available <= 0 || heights.natural <= heights.available) break;
    // small safety margin (0.98) so rounding/reflow on the real print
    // pipeline doesn't leave it juuust over the edge again
    scale *= (heights.available / heights.natural) * 0.98;
  }
  return voucherStylesCss(scale);
}

async function openVoucherWindow(title, bodyHtml) {
  // Open the window synchronously, before the await below - popup blockers
  // key off window.open() happening directly inside the click handler's
  // call stack, and an await in between (even one that resolves almost
  // immediately) can be enough for some browsers to treat it as no longer
  // user-triggered and block it. The final content just gets written into
  // this already-open window once the fitted sizes are known.
  const win = window.open("", "_blank", "width=700,height=900");
  if (!win) return;

  const css = await computeFittedCss(bodyHtml);

  win.document.open();
  win.document.write(pageHtml(title, css, bodyHtml));
  win.document.close();
  win.focus();
  win.onload = () => win.print();
}

function itemsRowsHtml(items) {
  return items
    .map(
      (i) => `<tr>
        <td>${i.StockItemCode ? `${i.StockItemCode}${i.StockName ? "-" + i.StockName : ""}` : (i.StockName || i.StockCode)}</td>
        <td style="text-align:right">${Number(i.Qty).toLocaleString()}</td>
        <td style="text-align:right">${Number(i.Price).toLocaleString()}</td>
        <td style="text-align:right">${Number(i.Amount).toLocaleString()}</td>
      </tr>`
    )
    .join("");
}

function totalsHtml(record) {
  return `
    <div class="totals">
      <div><span>Discount</span><span>${Number(record.Discount).toLocaleString()}</span></div>
      <div><span>Tax</span><span>${Number(record.Tax).toLocaleString()}</span></div>
      <div class="grand"><span>Total</span><span>${Number(record.TotalAmount).toLocaleString()}</span></div>
      <div><span>Paid</span><span>${Number(record.Paid).toLocaleString()}</span></div>
      <div><span>Leftover</span><span>${Number(record.LeftOver).toLocaleString()}</span></div>
    </div>
  `;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const pad2 = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DD..." -> "DD/MM/YYYY" (string-based: these are wall-clock
// timestamps without a timezone, see db/pool.js)
function fmtDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// "YYYY-MM-DD HH:MM" -> "HH:MM" (24h) or "hh:mm AM" (12h)
function fmtTime(v, twelveHour = false) {
  const m = /[T ](\d{2}):(\d{2})/.exec(v || "");
  if (!m) return "";
  if (!twelveHour) return `${m[1]}:${m[2]}`;
  const h = Number(m[1]);
  return `${pad2(h % 12 || 12)}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

const money = (n) => Number(n || 0).toLocaleString();

// Laid out like the legacy R_OpticSlip report - only the information area;
// the header/footer come from the voucher background.
export function printSaleVoucher(sale) {
  const o = sale.optic || {};
  const items = sale.items || [];
  const gross = items.reduce((sum, i) => sum + Number(i.Amount || 0), 0);
  // SaleDate is usually stored date-only, so take the time of day from CreateDate.
  const ownTime = fmtTime(sale.SaleDate);
  const saleTime = ownTime && ownTime !== "00:00" ? ownTime : fmtTime(sale.CreateDate);
  const ageText = String(sale.Age ?? "").trim();
  const age = /^\d+$/.test(ageText) ? `${ageText}yrs` : ageText;
  const delivery = o.deliverydate ? `${fmtDate(o.deliverydate)} ${fmtTime(o.deliverydate, true)}` : "";
  const soldBy = sale.CreateUser && sale.CreateUser !== "web" ? sale.CreateUser : "";

  const rxRow = (label, od, os) =>
    `<tr><td class="rx-lbl">${label}</td><td>${esc(od)}</td><td>${esc(os)}</td></tr>`;

  const rxHtml = sale.optic
    ? `<div class="slip-rx">
        <table>
          <thead><tr><th class="blank"></th><th>OD Right</th><th>OS Left</th></tr></thead>
          <tbody>${rxRow("Sphere", o.sphereod, o.sphereos)}${rxRow("Cylinder", o.cylinderod, o.cylinderos)}</tbody>
        </table>
        <table>
          <thead><tr><th class="blank"></th><th>OD Right</th><th>OS Left</th></tr></thead>
          <tbody>${rxRow("Axis", o.axisod, o.axisos)}${rxRow("Prism", o.prismod, o.prismos)}</tbody>
        </table>
      </div>`
    : "";

  const itemRows = items
    .map((i, idx) => {
      const name = i.StockItemCode ? `${i.StockItemCode}${i.StockName ? " - " + i.StockName : ""}` : (i.StockName || i.StockCode);
      const foc = Number(i.Amount || 0) === 0;
      return `<tr>
        <td class="c">${idx + 1}</td>
        <td>${esc(name)}</td>
        <td class="c">${money(i.Qty)}</td>
        <td class="r">${foc ? "FOC" : money(i.Price)}</td>
        <td class="r">${foc ? "FOC" : money(i.Amount)}</td>
      </tr>`;
    })
    .join("");

  const body = `
    <table class="slip-info">
      <tr><td class="lbl">No:</td><td>${esc(sale.SaleCode)}</td><td class="lbl">Date:</td><td>${fmtDate(sale.SaleDate)} ${saleTime}</td></tr>
      <tr><td class="lbl">Name:</td><td>${esc(sale.PatientName)}</td><td class="lbl">Member ID:</td><td>${esc(o.memberid || sale.memberID)}</td></tr>
      <tr><td class="lbl">Age:</td><td>${esc(age)}</td><td class="lbl">Address:</td><td>${esc(sale.PhoneNo)}</td></tr>
    </table>
    ${rxHtml}
    <table class="slip-items">
      <thead><tr><th style="width:6%">No</th><th>Item Name</th><th style="width:9%">Qty</th><th style="width:16%">Each</th><th style="width:18%">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="slip-bottom">
      <div class="slip-notes">
        <div><span class="lbl">Delivery Date :</span> &nbsp; ${delivery}</div>
        <div><span class="lbl">Remark :</span><div class="remark">${esc(sale.Note)}</div></div>
        ${o.pdmm ? `<div><span class="lbl">PD :</span> &nbsp; ${esc(o.pdmm)}</div>` : ""}
        <div><span class="lbl">Sold By :</span> &nbsp; ${esc(soldBy)}</div>
      </div>
      <table class="slip-sum">
        <tr><td>Total Amount:</td><td>${money(gross)}</td></tr>
        <tr><td>Discount:</td><td>${money(sale.Discount)}</td></tr>
        <tr><td>Tax:</td><td>${money(sale.Tax)}</td></tr>
        <tr class="net"><td>Net Amount:</td><td>${money(sale.TotalAmount)}</td></tr>
        <tr class="net"><td>Paid Amount:</td><td>${money(sale.Paid)}</td></tr>
        <tr><td>Balance Amount:</td><td>${money(sale.LeftOver)}</td></tr>
      </table>
    </div>
  `;
  openVoucherWindow(sale.SaleCode, body);
}

export function printPurchaseVoucher(purchase) {
  const body = `
    <div class="voucher-title">Purchase Voucher: ${purchase.PurchaseCode}</div>
    <div class="voucher-meta">
      Date: <b>${(purchase.PurchaseDate || "").slice(0, 10)}</b> &nbsp; | &nbsp;
      Supplier: <b>${purchase.SupplierName || "-"}</b> &nbsp; | &nbsp;
      Status: <b>${purchase.Status}</b>
    </div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${itemsRowsHtml(purchase.items)}</tbody>
    </table>
    ${totalsHtml(purchase)}
  `;
  openVoucherWindow(purchase.PurchaseCode, body);
}
