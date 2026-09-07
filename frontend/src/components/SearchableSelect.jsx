import Select from "react-select";

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

/**
 * Searchable dropdown, used everywhere a plain <select> would otherwise go.
 * options: [{ value, label }]
 * value: the raw selected value (not the option object)
 */
export default function SearchableSelect({ options, value, onChange, placeholder, isDisabled, isClearable = true, onInputChange, noOptionsMessage }) {
  const selected = options.find((o) => String(o.value) === String(value)) || null;

  return (
    <Select
      classNamePrefix="ss"
      styles={customStyles}
      options={options}
      value={selected}
      onChange={(opt) => onChange(opt ? opt.value : "")}
      onInputChange={onInputChange}
      noOptionsMessage={noOptionsMessage}
      placeholder={placeholder || "Select..."}
      isDisabled={isDisabled}
      isClearable={isClearable}
      isSearchable
      menuPortalTarget={document.body}
    />
  );
}
