import "./SaleDetailModal.css";

export default function SaleReturnDetailModal({ returnData, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{returnData.SaleCode}</h2>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="modal-meta">
          <div><span>Return Date</span><strong>{(returnData.ReturnDate || "").slice(0, 10)}</strong></div>
          <div><span>Customer</span><strong>{returnData.PatientName}</strong></div>
        </div>

        <table className="modal-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {returnData.items.map((i) => (
              <tr key={i.SaleReturnDtlID}>
                <td>{i.StockName || i.StockID}</td>
                <td className="num">{Number(i.Qty).toLocaleString()}</td>
                <td className="num">{Number(i.Price).toLocaleString()}</td>
                <td className="num">{Number(i.Amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="modal-totals">
          <div><span>Prev Amount</span><span>{Number(returnData.PrevAmount).toLocaleString()}</span></div>
          <div><span>Prev Leftover</span><span>{Number(returnData.PrevLeftover).toLocaleString()}</span></div>
          <div><span>Return Amount</span><span>{Number(returnData.ReturnAmount).toLocaleString()}</span></div>
          <div className="modal-grand"><span>Return Balance</span><span>{Number(returnData.ReturnBalance).toLocaleString()}</span></div>
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
