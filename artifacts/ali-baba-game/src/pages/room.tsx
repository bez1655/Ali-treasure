import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import GameBoard from "@/components/GameBoard";

interface Room {
  id: number;
  name: string;
  status: "waiting" | "active" | "finished";
  finishedAt: string | null;
}

interface GamePlayer {
  id: number;
  roomId: number;
  userId: number;
  username: string;
  position: number;
  color: string;
  canMove: boolean;
}

interface GameMove {
  id: number;
  userId: number;
  username: string;
  diceValue: number;
  fromPosition: number;
  toPosition: number;
  movedAt: string;
}

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export default function RoomPage({ roomId }: { roomId: number }) {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { joinRoom, leaveRoom, players: socketPlayers, lastDice, gameStarted } = useSocket();

  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const { data: room } = useQuery<Room>({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}`, { headers: authHeaders(token!) });
      if (!res.ok) throw new Error("Комната не найдена");
      return res.json();
    },
    enabled: !!token && !!roomId,
    refetchInterval: 5000,
  });

  const { data: httpPlayers, refetch: refetchPlayers } = useQuery<GamePlayer[]>({
    queryKey: ["players", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/players`, { headers: authHeaders(token!) });
      if (!res.ok) throw new Error("Ошибка");
      return res.json();
    },
    enabled: !!token && !!roomId,
    refetchInterval: 3000,
  });

  const { data: history, refetch: refetchHistory } = useQuery<GameMove[]>({
    queryKey: ["history", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/history`, { headers: authHeaders(token!) });
      if (!res.ok) throw new Error("Ошибка");
      return res.json();
    },
    enabled: !!token && !!roomId,
    refetchInterval: 3000,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST", headers: authHeaders(token!) });
      if (!res.ok) throw new Error("Ошибка входа");
      return res.json();
    },
    onSuccess: () => refetchPlayers(),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/start`, { method: "POST", headers: authHeaders(token!) });
      if (!res.ok) throw new Error("Ошибка старта");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["room", roomId] }),
  });

  const allowMoveMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/rooms/${roomId}/allow-move`, {
        method: "POST",
        headers: authHeaders(token!),
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Ошибка");
      return res.json();
    },
  });

  const rollMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/roll-dice`, { method: "POST", headers: authHeaders(token!) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.error ?? "Ход не разрешён");
      }
      return res.json() as Promise<{ diceValue: number; newPosition: number }>;
    },
    onSuccess: (data) => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      setDiceValue(data.diceValue);
      setRolling(false);
      refetchPlayers();
      refetchHistory();
    },
    onError: (e: any) => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      setRolling(false);
      alert(e.message);
    },
  });

  useEffect(() => {
    if (!token || !roomId) return;
    joinMutation.mutate();
    joinRoom(roomId);
    return () => { leaveRoom(roomId); };
  }, [token, roomId]);

  useEffect(() => {
    if (lastDice) {
      setDiceValue(lastDice.diceValue);
      refetchPlayers();
      refetchHistory();
    }
  }, [lastDice]);

  useEffect(() => {
    if (gameStarted) qc.invalidateQueries({ queryKey: ["room", roomId] });
  }, [gameStarted]);

  // Auto-scroll history to bottom
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleRollDice = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    let frame = 0;
    rollIntervalRef.current = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      frame++;
      if (frame > 8) { clearInterval(rollIntervalRef.current!); rollIntervalRef.current = null; }
    }, 80);
    rollMutation.mutate();
  }, [rolling]);

  const players: GamePlayer[] = socketPlayers.length > 0 ? socketPlayers : (httpPlayers ?? []);
  const myPlayer = players.find(p => p.userId === user?.id);
  const isAdmin = user?.role === "admin";
  const isActive = room?.status === "active" || gameStarted;
  const isFinished = room?.status === "finished";
  const canIMove = myPlayer?.canMove ?? false;
  const myPosition = myPlayer?.position ?? 0;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0B1426", color: "#F5E6C8" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #1A2744" }}>
        <button
          onClick={() => navigate("/rooms")}
          style={{ background: "transparent", border: "1px solid #2E4070", borderRadius: 8, color: "#A89060", padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
        >
          ‹ Назад
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{room?.name ?? "Комната"}</span>
          <span style={{
            marginLeft: 12, fontSize: 13,
            color: isFinished ? "#7F8C8D" : isActive ? "#2ECC71" : "#F0C040",
          }}>
            {isFinished ? "✅ Завершена" : isActive ? "🎮 Игра идёт" : "⏳ Ожидание"}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#6B7A9E" }}>{user?.username}</div>
      </div>

      {/* Main layout */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 12, display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }}>

        {/* Left: Board + status strip */}
        <div style={{ minWidth: 0 }}>
          <GameBoard players={players} />

          {/* Status strip */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, backgroundColor: "#1A2744", borderRadius: 12, padding: 12 }}>
            <StatCell label="Моя позиция" value={`📍 ${myPosition} / 60`} />
            <StatCell label="Игроков" value={`👥 ${players.length}`} />
            {diceValue !== null && <StatCell label="Последний бросок" value={DICE_FACES[diceValue - 1]} large />}
          </div>

          {/* History log */}
          <div style={{ marginTop: 12, backgroundColor: "#1A2744", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#D4A017", marginBottom: 10 }}>
              📜 История ходов {history ? `(${history.length})` : ""}
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {!history || history.length === 0 ? (
                <div style={{ color: "#6B7A9E", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                  Ходов ещё нет
                </div>
              ) : history.map((move) => (
                <div
                  key={move.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px", borderRadius: 8,
                    backgroundColor: move.userId === user?.id ? "#243358" : "#131e35",
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{DICE_FACES[move.diceValue - 1]}</span>
                  <span style={{ color: "#4ECDC4", fontWeight: 700, minWidth: 90 }}>{move.username}</span>
                  <span style={{ color: "#A89060" }}>
                    {move.fromPosition} → <span style={{ color: "#F0C040", fontWeight: 700 }}>{move.toPosition}</span>
                  </span>
                  {move.toPosition >= 60 && <span style={{ marginLeft: "auto" }}>🏆</span>}
                  <span style={{ marginLeft: "auto", color: "#6B7A9E", fontSize: 11 }}>
                    {new Date(move.movedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              <div ref={historyEndRef} />
            </div>
          </div>
        </div>

        {/* Right: Control panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Winner banner */}
          {isFinished && (
            <div style={{ backgroundColor: "#1A3A1A", border: "2px solid #2ECC71", borderRadius: 12, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>🏆</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#2ECC71", marginTop: 4 }}>Игра завершена!</div>
              {players.find(p => p.position >= 60) && (
                <div style={{ fontSize: 13, color: "#A89060", marginTop: 6 }}>
                  Победитель: <span style={{ color: "#F0C040", fontWeight: 700 }}>
                    {players.find(p => p.position >= 60)?.username}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Admin panel */}
          {isAdmin && (
            <Panel title="👑 Администратор">
              {!isActive && !isFinished && (
                <button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || players.length === 0}
                  style={{
                    width: "100%", padding: "12px 0", border: "none", borderRadius: 10,
                    background: "#2ECC71", color: "#000", fontWeight: 800, fontSize: 15,
                    cursor: "pointer", marginBottom: 8,
                    opacity: (startMutation.isPending || players.length === 0) ? 0.5 : 1,
                  }}
                >
                  {startMutation.isPending ? "Запускаю..." : "🚀 Начать игру"}
                </button>
              )}
              {isActive && (
                <>
                  <div style={{ fontSize: 12, color: "#A89060", marginBottom: 8 }}>Разрешить ход:</div>
                  {players.filter(p => p.userId !== user?.id).map(player => (
                    <button
                      key={player.id}
                      onClick={() => allowMoveMutation.mutate(player.userId)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: 10, marginBottom: 6, border: "1px solid",
                        borderColor: player.canMove ? "#2ECC71" : "#2E4070",
                        borderRadius: 10, background: player.canMove ? "#1A3A2A" : "#243358",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: player.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#F5E6C8" }}>{player.username}</div>
                        <div style={{ fontSize: 11, color: "#A89060" }}>Клетка {player.position}</div>
                      </div>
                      <span style={{ fontSize: 11, color: player.canMove ? "#2ECC71" : "#D4A017", fontWeight: 700 }}>
                        {player.canMove ? "✅ Ходит" : "Ход →"}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </Panel>
          )}

          {/* Player dice panel */}
          {!isAdmin && !isFinished && (
            <Panel title="🎲 Твой ход">
              {myPosition >= 60 ? (
                <div style={{ backgroundColor: "#1A3A1A", border: "2px solid #2ECC71", borderRadius: 10, padding: 16, textAlign: "center", color: "#2ECC71", fontWeight: 800 }}>
                  🏆 Ты нашёл клад! Победа!
                </div>
              ) : canIMove ? (
                <button
                  onClick={handleRollDice}
                  disabled={rolling}
                  style={{
                    width: "100%", padding: "20px 0", border: "none", borderRadius: 14,
                    background: "#D4A017", cursor: rolling ? "default" : "pointer",
                    boxShadow: "0 0 24px rgba(212,160,23,0.5)",
                    opacity: rolling ? 0.8 : 1,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}
                >
                  <span style={{ fontSize: 52 }}>{diceValue !== null ? DICE_FACES[diceValue - 1] : "🎲"}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#0B1426" }}>
                    {rolling ? "Бросаю..." : "Бросить кубик!"}
                  </span>
                </button>
              ) : (
                <div style={{ backgroundColor: "#243358", borderRadius: 12, padding: "20px 16px", textAlign: "center", color: "#A89060", fontSize: 14 }}>
                  {isActive ? "⏳ Жди разрешения администратора" : "⏳ Игра ещё не началась"}
                </div>
              )}
            </Panel>
          )}

          {/* Players list */}
          <Panel title="Участники">
            {players.length === 0 ? (
              <div style={{ color: "#6B7A9E", textAlign: "center", padding: "12px 0", fontSize: 13 }}>
                Игроки не присоединились
              </div>
            ) : players.map(player => (
              <div
                key={player.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 6px", borderBottom: "1px solid #2E4070",
                  backgroundColor: player.userId === user?.id ? "#24335820" : "transparent",
                  borderRadius: 6,
                }}
              >
                <div style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: player.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {player.username}{player.userId === user?.id ? " (ты)" : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "#A89060" }}>
                    Клетка {player.position} / 60
                    {player.position > 0 && (
                      <span style={{ marginLeft: 6 }}>
                        {"▓".repeat(Math.round(player.position / 6))}{"░".repeat(10 - Math.round(player.position / 6))}
                      </span>
                    )}
                  </div>
                </div>
                {player.canMove && <span title="Ходит сейчас">🎲</span>}
                {player.position >= 60 && <span title="Победил">🏆</span>}
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#6B7A9E", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: large ? 22 : 14, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#1A2744", border: "1px solid #2E407044", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#D4A017", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
