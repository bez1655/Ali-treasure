import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password.trim());
      navigate("/rooms");
    } catch (err: any) {
      setError(err?.message ?? "Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0B1426", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img
            src={`${import.meta.env.BASE_URL}icon.png`}
            alt="logo"
            style={{ width: 96, height: 96, borderRadius: "50%", border: "2px solid #D4A017", marginBottom: 16, display: "inline-block" }}
          />
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#D4A017", letterSpacing: 4, margin: 0 }}>АЛИ-БАБА</h1>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F0C040", letterSpacing: 3, margin: "4px 0 8px" }}>И 40 КЛАДОВ</h2>
          <p style={{ fontSize: 14, color: "#A89060", margin: 0 }}>Добро пожаловать в игру!</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, color: "#A89060", fontWeight: 600, marginBottom: 6, letterSpacing: 1 }}>
              ЛОГИН
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Введите логин"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                width: "100%", boxSizing: "border-box",
                backgroundColor: "#1A2744", border: "1px solid #2E4070",
                borderRadius: 12, padding: "14px 16px",
                fontSize: 16, color: "#F5E6C8",
                outline: "none",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, color: "#A89060", fontWeight: 600, marginBottom: 6, letterSpacing: 1 }}>
              ПАРОЛЬ
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Введите пароль"
              style={{
                width: "100%", boxSizing: "border-box",
                backgroundColor: "#1A2744", border: "1px solid #2E4070",
                borderRadius: 12, padding: "14px 16px",
                fontSize: 16, color: "#F5E6C8",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{ backgroundColor: "#2A1A1A", border: "1px solid #8B3333", borderRadius: 10, padding: "10px 14px", color: "#FF6B6B", fontSize: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            style={{
              backgroundColor: "#D4A017",
              border: "none", borderRadius: 12,
              padding: "16px", fontSize: 18, fontWeight: 800,
              color: "#0B1426", cursor: "pointer",
              boxShadow: "0 0 20px rgba(212,160,23,0.4)",
              opacity: (loading || !username.trim() || !password.trim()) ? 0.6 : 1,
              marginTop: 8,
            }}
          >
            {loading ? "Вход..." : "✨ Войти в игру"}
          </button>
        </form>
      </div>
    </div>
  );
}
