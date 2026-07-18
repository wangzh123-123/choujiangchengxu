import { useState, type FormEvent } from "react";
import { adminLogin } from "../api/client";

const TOKEN_KEY = "lottery_admin_token";

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

type Props = {
  onLoggedIn: () => void;
};

export function AdminLogin({ onLoggedIn }: Props) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await adminLogin(passphrase);
      setAdminToken(res.token);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  }

  return (
    <section className="admin-card">
      <h1>内部管理</h1>
      <p className="sub">请输入口令（不对观众展示）</p>
      <form className="enroll-form" onSubmit={onSubmit}>
        <label htmlFor="admin-pass">
          口令
          <input
            id="admin-pass"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
          />
        </label>
        <button type="submit">登录</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
