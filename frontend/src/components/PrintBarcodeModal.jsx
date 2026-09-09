import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { api } from "../api/client";
import { LABEL_SIZE_OPTIONS, LABEL_SIZES, printBarcodeLabels } from "../lib/printBarcode";
import "./SaleDetailModal.css";
import "./PrintBarcodeModal.css";

export default function PrintBarcodeModal({ item, onClose }) {
  const [sizeKey, setSizeKey] = useState("30x20");
  const [copies, setCopies] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [stockBalance, setStockBalance] = useState(null);
  const svgRef = useRef(null);

  const size = LABEL_SIZES[sizeKey];
  const hasBarcode = !!item.Barcode;

  useEffect(() => {
    if (!hasBarcode || !svgRef.current) return;
    JsBarcode(svgRef.current, item.Barcode, { format: "CODE128", displayValue: false, margin: 10, height: 90 });
  }, [item.Barcode, hasBarcode, sizeKey]);

  useEffect(() => {
    setStockBalance(null);
    // A freshly-created item passed straight into this modal has no
    // StockID yet (it hasn't round-tripped through the list), so there's
    // no balance to look up.
    if (!item.StockID) return;
    api.getStockTotalBalance(item.StockID).then((r) => setStockBalance(r.qty)).catch(() => {});
  }, [item.StockID]);

  function handlePrint() {
    printBarcodeLabels({
      stockName: item.StockName,
      stockCode: item.StockCode,
      barcodeValue: item.Barcode,
      price: item.sellprice,
      sizeKey,
      copies,
      showPrice,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box barcode-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Print Barcode</h2>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="barcode-modal-item">{item.StockCode} - {item.StockName}</div>

        {!hasBarcode ? (
          <div className="error">This item has no barcode set yet. Generate one first.</div>
        ) : (
          <>
            {item.StockID && (
              <div className="barcode-stock-balance">
                {stockBalance === null ? (
                  "Loading stock balance..."
                ) : (
                  <>
                    Stock Balance: <strong>{stockBalance}</strong>
                    {stockBalance > 0 && (
                      <button type="button" className="barcode-balance-use" onClick={() => setCopies(stockBalance)}>
                        Use as Copies
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="barcode-modal-fields">
              <div className="sale-field">
                <label>Label Size</label>
                <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
                  {LABEL_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="sale-field">
                <label>Copies</label>
                <input type="number" min={1} max={500} value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} />
              </div>
              <label className="checkbox-label barcode-price-check">
                <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
                {" "}Include price on label
              </label>
            </div>

            <div className="barcode-preview-wrap">
              <div
                className="barcode-preview-label"
                style={{ aspectRatio: `${size.width} / ${size.height}` }}
              >
                <div className="barcode-preview-svg-wrap">
                  <svg ref={svgRef} className="barcode-preview-svg" />
                </div>
                <div className="barcode-preview-name">{item.StockCode} - {item.StockName}</div>
                {showPrice && (
                  <div className="barcode-preview-price">
                    {Number(item.sellprice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>

            <div className="button-row barcode-modal-actions">
              <button className="btn-secondary" onClick={onClose}>Close</button>
              <button className="btn-primary" onClick={handlePrint}>Print</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
