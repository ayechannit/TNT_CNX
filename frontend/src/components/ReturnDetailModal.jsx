import "./SaleDetailModal.css";

export default function ReturnDetailModal({ returnData, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{returnData.ReturnCode}</h2>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="modal-meta">
          <div><span>Date</span><strong>{(returnData.Date || "").slice(0, 10)}</strong></div>
          <div><span>Type</span><strong>{returnData.Type}</strong></div>
          <div><span>Supplier</span><strong>{returnData.SupplierName}</strong></div>
          <div><span>Status</span><strong>{returnData.Status}</strong></div>
        </div>

        <table className="modal-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {returnData.items.map((i) => (
              <tr key={i.ReturnDtlID}>
                <td>{i.StockName || i.StockCode}</td>
                <td className="num">{Number(i.Qty).toLocaleString()}</td>
                <td className="num">{Number(i.Price).toLocaleString()}</td>
                <td className="num">{Number(i.Amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="modal-totals">
          <div className="modal-grand"><span>Total</span><span>{Number(returnData.TotalAmount).toLocaleString()}</span></div>
          <div><span>Paid</span><span>{Number(returnData.Paid).toLocaleString()}</span></div>
          <div><span>Leftover</span><span>{Number(returnData.LeftOver).toLocaleString()}</span></div>
        </div>

        {returnData.Note && (
          <div className="modal-optic">
            <h3>Note</h3>
            <p>{returnData.Note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
