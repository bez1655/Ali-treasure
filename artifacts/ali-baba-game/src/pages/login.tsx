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

  const isPlayer = username.startsWith("@");
  const isAdmin = username.length > 0 && !username.startsWith("@");

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
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0B1426",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      backgroundImage: "radial-gradient(ellipse at 50% 0%, #1a2a4a 0%, #0B1426 70%)",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
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

        {/* Hint cards */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <div style={{
            flex: 1, backgroundColor: "#1A2744", border: "1px solid #2E4070",
            borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#A89060", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>🎲</div>
            <div style={{ fontWeight: 700, color: "#F0C040", marginBottom: 2 }}>Игрок</div>
            <div>Логин: <span style={{ color: "#4ECDC4" }}>@ваш_ник</span></div>
            <div style={{ marginTop: 2 }}>Первый вход = регистрация</div>
          </div>
          <div style={{
            flex: 1, backgroundColor: "#1A2744", border: "1px solid #2E4070",
            borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#A89060", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>👑</div>
            <div style={{ fontWeight: 700, color: "#D4A017", marginBottom: 2 }}>Администратор</div>
            <div>Логин: <span style={{ color: "#D4A017" }}>admin</span></div>
            <div style={{ marginTop: 2 }}>Управляет игрой</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, color: "#A89060", fontWeight: 600, marginBottom: 6, letterSpacing: 1 }}>
              ЛОГИН
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="@ваш_ник или admin"
                autoCapitalize="none"
                autoCorrect="off"
                style={{
                  width: "100%", boxSizing: "border-box",
                  backgroundColor: "#1A2744",
                  border: `1px solid ${isPlayer ? "#4ECDC4" : isAdmin ? "#D4A017" : "#2E4070"}`,
                  borderRadius: 12, padding: "14px 46px 14px 16px",
                  fontSize: 16, color: "#F5E6C8", outline: "none",
                  transition: "border-color 0.2s",
                }}
              />
              {isPlayer && (
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18 }}>🎲</span>
              )}
              {isAdmin && (
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18 }}>👑</span>
              )}
            </div>
            {isPlayer && (
              <div style={{ fontSize: 11, color: "#4ECDC4", marginTop: 4, marginLeft: 4 }}>
                Игрок — при первом входе аккаунт создаётся автоматически
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, color: "#A89060", fontWeight: 600, marginBottom: 6, letterSpacing: 1 }}>
              ПАРОЛЬ
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Придумайте или введите пароль"
              style={{
                width: "100%", boxSizing: "border-box",
                backgroundColor: "#1A2744", border: "1px solid #2E4070",
                borderRadius: 12, padding: "14px 16px",
                fontSize: 16, color: "#F5E6C8", outline: "none",
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
              marginTop: 8, transition: "opacity 0.2s",
            }}
          >
            {loading ? "Вхожу..." : "✨ Войти в игру"}
          </button>
        </form>
      </div>
    </div>
  );
}
