import JsBarcode from "jsbarcode";

// Mirrors the label sizes from the legacy WinForms FrmPrintBarcode.cs dialog.
export const LABEL_SIZES = {
  "40x30": { label: "40 x 30 mm", width: 40, height: 30, sheet: false },
  "50x30": { label: "50 x 30 mm", width: 50, height: 30, sheet: false },
  "50x25": { label: "50 x 25 mm", width: 50, height: 25, sheet: false },
  "30x20": { label: "30 x 20 mm", width: 30, height: 20, sheet: false },
  a4sheet: { label: "A4 Sheet (multiple labels per page)", width: 50, height: 30, sheet: true },
};

export const LABEL_SIZE_OPTIONS = Object.entries(LABEL_SIZES).map(([value, v]) => ({ value, label: v.label }));

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// JsBarcode needs the SVG attached to a real layout to measure text, even
// though we only want the serialized markup - render into a hidden node,
// serialize, then remove it.
export function renderBarcodeSvgMarkup(value) {
  // The hidden styling has to live on a wrapper, not the <svg> itself -
  // XMLSerializer would otherwise bake a "visibility: hidden" inline style
  // straight into the markup we hand to the print window, making the
  // barcode invisible there too even though this offscreen render never
  // shows up in the app's own UI.
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.visibility = "hidden";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  container.appendChild(svg);
  try {
    // A scanner needs a blank quiet zone on each side of the bars to find
    // the start/stop - margin: 0 here made printed labels unscannable.
    JsBarcode(svg, value, { format: "CODE128", displayValue: false, margin: 10, height: 90 });
    return new XMLSerializer().serializeToString(svg);
  } finally {
    document.body.removeChild(container);
  }
}

function labelHtml(svgMarkup, stockCode, stockName, price, showPrice) {
  const label = stockCode ? `${stockCode} - ${stockName}` : stockName;
  return `
    <div class="barcode-label">
      <div class="barcode-svg-wrap">${svgMarkup}</div>
      <div class="barcode-name">${escapeHtml(label)}</div>
      ${showPrice ? `<div class="barcode-price">${Number(price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ""}
    </div>
  `;
}

export function printBarcodeLabels({ stockName, stockCode, barcodeValue, price, sizeKey, copies, showPrice }) {
  if (!barcodeValue) return;
  const size = LABEL_SIZES[sizeKey] || LABEL_SIZES["50x30"];
  const svgMarkup = renderBarcodeSvgMarkup(barcodeValue);
  const label = labelHtml(svgMarkup, stockCode, stockName, price, showPrice);
  const count = Math.max(1, Math.min(500, Number(copies) || 1));
  const labels = Array.from({ length: count }, () => label).join("");

  const pageCss = size.sheet
    ? `@page { size: A4; margin: 8mm; }`
    : `@page { size: ${size.width}mm ${size.height}mm; margin: 0; }`;

  const layoutCss = size.sheet
    ? `
      .barcode-sheet { display: flex; flex-wrap: wrap; gap: 2mm; }
      .barcode-label { width: ${size.width}mm; height: ${size.height}mm; break-inside: avoid; border: 1px dashed #ccc; }
    `
    : `
      .barcode-label { width: ${size.width}mm; height: ${size.height}mm; page-break-after: always; }
      .barcode-label:last-child { page-break-after: auto; }
    `;

  const html = `
    <html>
    <head>
      <title>Barcode - ${escapeHtml(stockCode)}</title>
      <style>
        ${pageCss}
        html, body { margin: 0; padding: 0; }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body { font-family: 'Segoe UI', sans-serif; }
        .barcode-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5mm;
          overflow: hidden;
        }
        .barcode-svg-wrap {
          flex: 1 1 auto;
          min-height: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
        }
        .barcode-svg-wrap svg { width: 98%; height: 100%; }
        .barcode-name {
          flex: 0 0 auto;
          font-size: 2.4mm;
          text-align: center;
          line-height: 1.1;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .barcode-price { flex: 0 0 auto; font-size: 2.8mm; font-weight: 700; text-align: center; }
        ${layoutCss}
      </style>
    </head>
    <body>
      ${size.sheet ? `<div class="barcode-sheet">${labels}</div>` : labels}
    </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=500,height=650");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => win.print();
}
