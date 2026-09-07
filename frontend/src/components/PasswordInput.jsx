import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";
import "./PasswordInput.css";

export default function PasswordInput({ value, onChange, disabled, autoFocus, onKeyDown }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrap">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="password-toggle-btn"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
