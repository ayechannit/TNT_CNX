import "./SearchBox.css";

export default function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="search-box-wrap">
      <svg className="search-box-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="#8a9494" strokeWidth="1.5" />
        <line x1="11.2" y1="11.2" x2="15" y2="15" stroke="#8a9494" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        className="search-box-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-box-clear"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          &#10005;
        </button>
      )}
    </div>
  );
}
