import { useEffect, useState } from "react";
import { api } from "../api/client";
import "./ItemFinder.css";

/**
 * Scan-or-search item finder, used to add a line item to a cart (Sale,
 * Purchase, Transfer, Return). A barcode scanner types the code then sends
 * Enter - if that matches exactly one result, it's added immediately. Typing
 * a partial name/code shows a dropdown of matches to click.
 */
export default function ItemFinder({ onSelect, placeholder }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .searchStock({ q: text, pageSize: 8 })
        .then((r) => {
          setResults(r.data);
          setOpen(true);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [text]);

  function pick(item) {
    onSelect(item);
    setText("");
    setResults([]);
    setOpen(false);
  }

  async function handleKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = text.trim();
    if (!code) return;

    // A scanner sends digits + Enter faster than the 200ms search debounce
    // below can resolve, so `results` is usually stale/empty by the time
    // Enter fires. Look up the exact barcode directly instead of waiting on it.
    try {
      const item = await api.getStockByBarcode(code);
      pick(item);
      return;
    } catch {
      // Not an exact barcode match - fall through to whatever the typeahead found.
    }

    if (results.length === 0) return;
    const exactBarcode = results.find((r) => r.Barcode && r.Barcode === code);
    if (exactBarcode) {
      pick(exactBarcode);
    } else if (results.length === 1) {
      pick(results[0]);
    }
  }

  return (
    <div className="item-finder">
      <input
        className="item-finder-input"
        placeholder={placeholder || "Scan barcode or search item..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div className="item-finder-dropdown">
          {results.map((r) => (
            <div key={r.StockID} className="item-finder-option" onMouseDown={() => pick(r)}>
              <span className="item-finder-name">{r.StockName}</span>
              <span className="item-finder-meta">
                {r.StockCode} · {Number(r.sellprice).toLocaleString()}
                {r.Barcode ? ` · ${r.Barcode}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
