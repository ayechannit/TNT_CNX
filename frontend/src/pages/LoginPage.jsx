import { useState } from "react";
import { api } from "../api/client";
import PasswordInput from "../components/PasswordInput";
import tntLogo from "../assets/tnt-logo.png";
import "./LoginPage.css";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.login(username.trim(), password);
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={submit}>
        <img src={tntLogo} alt="TNT" className="login-logo" />
        <h1>TNT MPOS</h1>

        {error && <div className="login-error">{error}</div>}

        <label>Username</label>
        <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />

        <label>Password</label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="login-submit" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
