import { fmtDate, fmtTime } from "../lib/printVoucher";
import { stockLabel } from "../lib/stockLabel";
import "./SaleDetailModal.css";

export default function PurchaseDetailModal({ purchase, onClose }) {
  // PurchaseDate holds only the date; the time comes from when it was saved.
  const ownTime = fmtTime(purchase.PurchaseDate);
  const purchaseTime = ownTime && ownTime !== "00:00" ? ownTime : fmtTime(purchase.CreateDate);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{purchase.PurchaseCode}</h2>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="modal-meta">
          <div><span>Date</span><strong>{fmtDate(purchase.PurchaseDate)} {purchaseTime}</strong></div>
          <div><span>Supplier</span><strong>{purchase.SupplierName || "-"}</strong></div>
          <div><span>Status</span><strong>{purchase.Status}</strong></div>
        </div>

        <table className="modal-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {purchase.items.map((i) => (
              <tr key={i.PurchaseDtlID}>
                <td>{stockLabel(i.StockItemCode, i.StockName)}</td>
                <td className="num">{Number(i.Qty).toLocaleString()}</td>
                <td className="num">{Number(i.Price).toLocaleString()}</td>
                <td className="num">{Number(i.Amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="modal-totals">
          <div><span>Discount</span><span>{Number(purchase.Discount).toLocaleString()}</span></div>
          <div><span>Tax</span><span>{Number(purchase.Tax).toLocaleString()}</span></div>
          <div className="modal-grand"><span>Total</span><span>{Number(purchase.TotalAmount).toLocaleString()}</span></div>
          <div><span>Paid</span><span>{Number(purchase.Paid).toLocaleString()}</span></div>
          <div><span>Leftover</span><span>{Number(purchase.LeftOver).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  );
}
