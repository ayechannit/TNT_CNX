import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "./icons";
import "./RowActionsMenu.css";

/**
 * Compact "..." action menu for table rows, used wherever a row would
 * otherwise need many action buttons crammed into one cell.
 * actions: [{ label, onClick, danger? }]
 */
export default function RowActionsMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="row-actions-menu" ref={ref}>
      <button className="row-actions-trigger" onClick={() => setOpen((o) => !o)} aria-label="More actions">
        <MoreIcon />
      </button>
      {open && (
        <div className="row-actions-dropdown">
          {actions.map((a, i) => (
            <div key={i}>
              {a.danger && i > 0 && !actions[i - 1].danger && <div className="row-actions-divider" />}
              <button
                className={a.danger ? "row-actions-item danger" : "row-actions-item"}
                onClick={() => { setOpen(false); a.onClick(); }}
              >
                {a.icon && <span className="row-actions-icon">{a.icon}</span>}
                {a.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
