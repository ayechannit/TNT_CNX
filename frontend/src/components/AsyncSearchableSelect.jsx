import AsyncSelect from "react-select/async";

const customStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    borderRadius: 6,
    borderColor: state.isFocused ? "teal" : "#ccd3d3",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(0, 128, 128, 0.15)" : "none",
    "&:hover": { borderColor: "teal" },
    fontSize: 14,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "teal" : state.isFocused ? "#eef5f5" : "white",
    color: state.isSelected ? "white" : "#1a1a1a",
    cursor: "pointer",
    fontSize: 14,
  }),
  menu: (base) => ({ ...base, zIndex: 20 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  placeholder: (base) => ({ ...base, color: "#8a9494" }),
};

function debounce(fn, delay) {
  let timer;
  return (...args) =>
    new Promise((resolve) => {
      clearTimeout(timer);
      timer = setTimeout(() => resolve(fn(...args)), delay);
    });
}

/**
 * Same look as SearchableSelect, but options are searched from the server
 * as the user types instead of being preloaded once - needed for pickers
 * over tables that can grow far past what's reasonable to fetch in full
 * (e.g. customers). `loadOptions(query)` should resolve to [{value,label,raw}].
 * `selected` is the currently-picked option ({value,label,raw} or null) - kept
 * by the caller since it may not be present in the last-loaded options page.
 */
export default function AsyncSearchableSelect({
  loadOptions,
  selected,
  onChange,
  onInputChange,
  placeholder,
  isClearable = true,
  noOptionsMessage,
}) {
  const debouncedLoad = debounce(loadOptions, 250);

  return (
    <AsyncSelect
      classNamePrefix="ss"
      styles={customStyles}
      value={selected}
      onChange={(opt) => onChange(opt)}
      onInputChange={onInputChange}
      loadOptions={debouncedLoad}
      defaultOptions
      cacheOptions
      noOptionsMessage={noOptionsMessage}
      placeholder={placeholder || "Type to search..."}
      isClearable={isClearable}
      isSearchable
      menuPortalTarget={document.body}
    />
  );
}
