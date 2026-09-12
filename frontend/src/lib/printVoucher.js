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

export function printSaleVoucher(sale) {
  const opticHtml = sale.optic
    ? `<div class="optic-box">
        <table>
          <tr><td><b>Sphere OD/OS</b></td><td>${sale.optic.sphereod || "-"} / ${sale.optic.sphereos || "-"}</td>
              <td><b>Cylinder OD/OS</b></td><td>${sale.optic.cylinderod || "-"} / ${sale.optic.cylinderos || "-"}</td></tr>
          <tr><td><b>Axis OD/OS</b></td><td>${sale.optic.axisod || "-"} / ${sale.optic.axisos || "-"}</td>
              <td><b>Prism OD/OS</b></td><td>${sale.optic.prismod || "-"} / ${sale.optic.prismos || "-"}</td></tr>
          <tr><td><b>PD</b></td><td>${sale.optic.pdmm || "-"}</td>
              <td><b>Delivery</b></td><td>${sale.optic.deliverydate || "-"}</td></tr>
        </table>
      </div>`
    : "";

  const body = `
    <div class="voucher-title">Voucher: ${sale.SaleCode}</div>
    <div class="voucher-meta">
      Date: <b>${(sale.SaleDate || "").slice(0, 10)}</b> &nbsp; | &nbsp;
      Customer: <b>${sale.PatientName || "-"}</b> &nbsp; | &nbsp;
      Status: <b>${sale.Status}</b>
    </div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${itemsRowsHtml(sale.items)}</tbody>
    </table>
    ${totalsHtml(sale)}
    ${opticHtml}
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
