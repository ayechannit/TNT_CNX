import "./SaleDetailModal.css";

export default function SaleDetailModal({ sale, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{sale.SaleCode}</h2>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="modal-meta">
          <div><span>Date</span><strong>{(sale.SaleDate || "").slice(0, 10)}</strong></div>
          <div><span>Customer</span><strong>{sale.PatientName || "-"}</strong></div>
          <div><span>Status</span><strong>{sale.Status}</strong></div>
        </div>

        <table className="modal-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.SaleDtlID}>
                <td>{i.StockItemCode ? `${i.StockItemCode}${i.StockName ? "-" + i.StockName : ""}` : (i.StockName || "")}</td>
                <td className="num">{Number(i.Qty).toLocaleString()}</td>
                <td className="num">{Number(i.Price).toLocaleString()}</td>
                <td className="num">{Number(i.Amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="modal-totals">
          <div><span>Discount</span><span>{Number(sale.Discount).toLocaleString()}</span></div>
          <div><span>Tax</span><span>{Number(sale.Tax).toLocaleString()}</span></div>
          <div className="modal-grand"><span>Total</span><span>{Number(sale.TotalAmount).toLocaleString()}</span></div>
          <div><span>Paid</span><span>{Number(sale.Paid).toLocaleString()}</span></div>
          <div><span>Leftover</span><span>{Number(sale.LeftOver).toLocaleString()}</span></div>
        </div>

        {sale.optic && (
          <div className="modal-optic">
            <h3>Optic Details</h3>
            <div className="modal-optic-grid">
              {sale.optic.memberid && <div><span>Member ID</span><strong>{sale.optic.memberid}</strong></div>}
              {sale.optic.deliverydate && <div><span>Delivery</span><strong>{sale.optic.deliverydate}</strong></div>}
              {sale.optic.pdmm && <div><span>PD</span><strong>{sale.optic.pdmm}</strong></div>}
              <div><span>Sphere OD/OS</span><strong>{sale.optic.sphereod || "-"} / {sale.optic.sphereos || "-"}</strong></div>
              <div><span>Cylinder OD/OS</span><strong>{sale.optic.cylinderod || "-"} / {sale.optic.cylinderos || "-"}</strong></div>
              <div><span>Axis OD/OS</span><strong>{sale.optic.axisod || "-"} / {sale.optic.axisos || "-"}</strong></div>
              <div><span>Prism OD/OS</span><strong>{sale.optic.prismod || "-"} / {sale.optic.prismos || "-"}</strong></div>
              <div><span>Order Status</span><strong>{sale.optic.status}</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
