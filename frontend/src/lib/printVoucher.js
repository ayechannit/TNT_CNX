import voucherBg from "../assets/tnt-voucher-bg.png";

const VOUCHER_STYLES = `
  @page { size: A5; margin: 0; }
  html, body { margin: 0; padding: 0; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body { font-family: 'Segoe UI', sans-serif; color: #1a1a1a; }
  .voucher-page {
    position: relative;
    width: 148mm;
    height: 210mm;
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
    padding: 8px 10px;
    box-sizing: border-box;
  }
  .voucher-title { font-size: 13px; font-weight: 700; margin: 0 0 4px; }
  .voucher-meta { font-size: 9px; color: #444; margin-bottom: 8px; }
  .voucher-meta b { color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { padding: 3px 4px; border-bottom: 1px solid #ddd; font-size: 9px; text-align: left; }
  th { font-size: 8px; text-transform: uppercase; color: #555; }
  .totals { width: 55%; margin-left: auto; font-size: 9px; }
  .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
  .totals .grand { font-weight: 700; font-size: 11px; border-top: 1px solid #333; margin-top: 3px; padding-top: 4px; }
  .optic-box { margin-top: 8px; font-size: 8.5px; }
  .optic-box table td { font-size: 8.5px; padding: 2px 4px; }
`;

function openVoucherWindow(title, bodyHtml) {
  const html = `
    <html>
    <head>
      <title>${title}</title>
      <style>${VOUCHER_STYLES}</style>
    </head>
    <body>
      <div class="voucher-page">
        <div class="voucher-content">${bodyHtml}</div>
      </div>
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

function itemsRowsHtml(items) {
  return items
    .map(
      (i) => `<tr>
        <td>${i.StockName || i.StockCode}</td>
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
