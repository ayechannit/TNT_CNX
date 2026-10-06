import { fmtDate, fmtTime } from "../lib/printVoucher";
import "./SaleDetailModal.css";
import "./SaleSlip.css";

const money = (n) => Number(n || 0).toLocaleString();

// Same layout as the printed sale voucher (printSaleVoucher) - the legacy
// R_OpticSlip report's information area.
export default function SaleDetailModal({ sale, onClose }) {
  const o = sale.optic || {};
  const items = sale.items || [];
  const gross = items.reduce((sum, i) => sum + Number(i.Amount || 0), 0);
  const ownTime = fmtTime(sale.SaleDate);
  const saleTime = ownTime && ownTime !== "00:00" ? ownTime : fmtTime(sale.CreateDate);
  const ageText = String(sale.Age ?? "").trim();
  const age = /^\d+$/.test(ageText) ? `${ageText}yrs` : ageText;
  const delivery = o.deliverydate ? `${fmtDate(o.deliverydate)} ${fmtTime(o.deliverydate, true)}` : "";
  const soldBy = sale.CreateUser && sale.CreateUser !== "web" ? sale.CreateUser : "";

  const rxRow = (label, od, os) => (
    <tr>
      <td className="rx-lbl">{label}</td>
      <td>{od}</td>
      <td>{os}</td>
    </tr>
  );
  const rxHead = (
    <thead>
      <tr><th className="blank"></th><th>OD Right</th><th>OS Left</th></tr>
    </thead>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box sale-slip-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{sale.SaleCode}</h2>
          <div className="sale-slip-header-right">
            <span className="sale-slip-status">{sale.Status}{sale.optic?.status ? ` · ${sale.optic.status}` : ""}</span>
            <button className="modal-close" onClick={onClose}>&#10005;</button>
          </div>
        </div>

        <div className="sale-slip">
          <table className="slip-info">
            <tbody>
              <tr><td className="lbl">No:</td><td>{sale.SaleCode}</td><td className="lbl">Date:</td><td>{fmtDate(sale.SaleDate)} {saleTime}</td></tr>
              <tr><td className="lbl">Name:</td><td>{sale.PatientName}</td><td className="lbl">Member ID:</td><td>{o.memberid || sale.memberID}</td></tr>
              <tr><td className="lbl">Age:</td><td>{age}</td><td className="lbl">Address:</td><td>{sale.PhoneNo}</td></tr>
            </tbody>
          </table>

          {sale.optic && (
            <div className="slip-rx">
              <table>
                {rxHead}
                <tbody>{rxRow("Sphere", o.sphereod, o.sphereos)}{rxRow("Cylinder", o.cylinderod, o.cylinderos)}</tbody>
              </table>
              <table>
                {rxHead}
                <tbody>{rxRow("Axis", o.axisod, o.axisos)}{rxRow("Prism", o.prismod, o.prismos)}</tbody>
              </table>
            </div>
          )}

          <div className="slip-items-wrap">
            <table className="slip-items">
              <thead>
                <tr><th style={{ width: "7%" }}>No</th><th>Item Name</th><th style={{ width: "9%" }}>Qty</th><th style={{ width: "16%" }}>Each</th><th style={{ width: "18%" }}>Total</th></tr>
              </thead>
              <tbody>
                {items.map((i, idx) => {
                  const foc = Number(i.Amount || 0) === 0;
                  return (
                    <tr key={i.SaleDtlID}>
                      <td className="c">{idx + 1}</td>
                      <td>{i.StockItemCode ? `${i.StockItemCode}${i.StockName ? " - " + i.StockName : ""}` : (i.StockName || "")}</td>
                      <td className="c">{money(i.Qty)}</td>
                      <td className="r">{foc ? "FOC" : money(i.Price)}</td>
                      <td className="r">{foc ? "FOC" : money(i.Amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="slip-bottom">
            <div className="slip-notes">
              <div><span className="lbl">Delivery Date :</span> {delivery}</div>
              <div><span className="lbl">Remark :</span><div className="remark">{sale.Note}</div></div>
              {o.pdmm && <div><span className="lbl">PD :</span> {o.pdmm}</div>}
              <div><span className="lbl">Sold By :</span> {soldBy}</div>
            </div>
            <table className="slip-sum">
              <tbody>
                <tr><td>Total Amount:</td><td>{money(gross)}</td></tr>
                <tr><td>Discount:</td><td>{money(sale.Discount)}</td></tr>
                <tr><td>Tax:</td><td>{money(sale.Tax)}</td></tr>
                <tr className="net"><td>Net Amount:</td><td>{money(sale.TotalAmount)}</td></tr>
                <tr className="net"><td>Paid Amount:</td><td>{money(sale.Paid)}</td></tr>
                <tr><td>Balance Amount:</td><td>{money(sale.LeftOver)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
