import "./SaleDetailModal.css";

export default function TransferDetailModal({ transfer, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{transfer.TransferCode}</h2>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="modal-meta">
          <div><span>Date</span><strong>{(transfer.TransferDate || "").slice(0, 10)}</strong></div>
          <div><span>From</span><strong>{transfer.FromBranchName}</strong></div>
          <div><span>To</span><strong>{transfer.ToBranchName}</strong></div>
          <div><span>Status</span><strong>{transfer.TransferStatus}</strong></div>
        </div>

        <table className="modal-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>
            {transfer.items.map((i) => (
              <tr key={i.TransferDtlID}>
                <td>{i.StockName || i.FK_StockCode}</td>
                <td className="num">{Number(i.Qty).toLocaleString()}</td>
                <td className="num">{Number(i.Price).toLocaleString()}</td>
                <td className="num">{Number(i.Total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="modal-totals">
          <div className="modal-grand"><span>Total</span><span>{Number(transfer.TotalAmount).toLocaleString()}</span></div>
        </div>

        {transfer.Remark && (
          <div className="modal-optic">
            <h3>Remark</h3>
            <p>{transfer.Remark}</p>
          </div>
        )}
      </div>
    </div>
  );
}
