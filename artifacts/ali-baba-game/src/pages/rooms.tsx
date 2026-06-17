import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface Room {
  id: number;
  name: string;
  status: "waiting" | "active" | "finished";
}

const STATUS_LABEL: Record<string, string> = {
  waiting: "⏳ Ожидание",
  active: "🎮 Идёт игра",
  finished: "✅ Завершена",
};

const STATUS_COLOR: Record<string, string> = {
  waiting: "#F0C040",
  active: "#2ECC71",
  finished: "#7F8C8D",
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export default function RoomsPage() {
  const { user, token, logout } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [newRoomName, setNewRoomName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms", { headers: authHeaders(token!) });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: authHeaders(token!),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Ошибка создания");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setNewRoomName("");
      setShowCreate(false);
    },
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0B1426", color: "#F5E6C8" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #1A2744" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Привет, {user?.username}!</div>
          <div style={{ fontSize: 13, color: "#A89060", marginTop: 2 }}>
            {user?.role === "admin" ? "👑 Администратор" : "🎲 Игрок"}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ padding: "8px 16px", border: "1px solid #2E4070", borderRadius: 8, background: "transparent", color: "#A89060", cursor: "pointer", fontSize: 13 }}
        >
          Выйти
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 24px" }}>
        {/* Admin: create room */}
        {user?.role === "admin" && (
          <div style={{ marginBottom: 20 }}>
            {showCreate ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  autoFocus
                  type="text"
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newRoomName.trim() && createMutation.mutate(newRoomName.trim())}
                  placeholder="Название комнаты"
                  style={{ backgroundColor: "#1A2744", border: "1px solid #2E4070", borderRadius: 10, padding: "12px 14px", fontSize: 16, color: "#F5E6C8", outline: "none" }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setShowCreate(false)}
                    style={{ flex: 1, padding: 12, border: "1px solid #2E4070", borderRadius: 10, background: "#1A2744", color: "#A89060", cursor: "pointer", fontSize: 15 }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => newRoomName.trim() && createMutation.mutate(newRoomName.trim())}
                    disabled={!newRoomName.trim() || createMutation.isPending}
                    style={{ flex: 2, padding: 12, border: "none", borderRadius: 10, background: "#D4A017", color: "#0B1426", cursor: "pointer", fontSize: 15, fontWeight: 700, opacity: (!newRoomName.trim() || createMutation.isPending) ? 0.5 : 1 }}
                  >
                    {createMutation.isPending ? "Создаю..." : "Создать"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                style={{ width: "100%", padding: 14, border: "1px dashed #D4A017", borderRadius: 12, background: "#1A2744", color: "#D4A017", cursor: "pointer", fontSize: 16, fontWeight: 700 }}
              >
                ＋ Создать комнату
              </button>
            )}
          </div>
        )}

        {/* Rooms list */}
        <div style={{ fontSize: 13, fontWeight: 700, color: "#A89060", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          Комнаты игры
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#D4A017", fontSize: 24 }}>⏳</div>
        ) : (rooms ?? []).length === 0 ? (
          <div style={{ textAlign: "center", color: "#6B7A9E", padding: "60px 0", fontSize: 16 }}>Нет доступных комнат</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(rooms ?? []).map(room => (
              <div
                key={room.id}
                onClick={() => navigate(`/room/${room.id}`)}
                style={{ backgroundColor: "#1A2744", border: "1px solid #2E4070", borderRadius: 12, padding: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#D4A017")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#2E4070")}
              >
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{room.name}</div>
                  <div style={{ fontSize: 13, color: STATUS_COLOR[room.status] ?? "#888" }}>
                    {STATUS_LABEL[room.status] ?? room.status}
                  </div>
                </div>
                <span style={{ fontSize: 24, color: "#D4A017" }}>›</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
