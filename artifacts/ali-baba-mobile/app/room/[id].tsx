import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import GameBoard from "../../components/GameBoard";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost";

function apiUrl(path: string) {
  return `https://${DOMAIN}/api${path}`;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

interface Room {
  id: number;
  name: string;
  status: "waiting" | "active" | "finished";
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

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = Number(id);
  const { user, token } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { joinRoom, leaveRoom, players: socketPlayers, allowedUserId, lastDice, gameStarted } = useSocket();

  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const diceAnim = useRef(new Animated.Value(0)).current;
  const diceDisplay = useRef(new Animated.Value(1)).current;

  const { data: room, isLoading: roomLoading } = useQuery<Room>({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/rooms/${roomId}`), {
        headers: authHeaders(token!),
      });
      if (!res.ok) throw new Error("Комната не найдена");
      return res.json();
    },
    enabled: !!token && !!roomId,
    refetchInterval: 5000,
  });

  const { data: httpPlayers, refetch: refetchPlayers } = useQuery<GamePlayer[]>({
    queryKey: ["players", roomId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/rooms/${roomId}/players`), {
        headers: authHeaders(token!),
      });
      if (!res.ok) throw new Error("Ошибка");
      return res.json();
    },
    enabled: !!token && !!roomId,
    refetchInterval: 3000,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/rooms/${roomId}/join`), {
        method: "POST",
        headers: authHeaders(token!),
      });
      if (!res.ok) throw new Error("Ошибка входа в комнату");
      return res.json();
    },
    onSuccess: () => {
      refetchPlayers();
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/rooms/${roomId}/start`), {
        method: "POST",
        headers: authHeaders(token!),
      });
      if (!res.ok) throw new Error("Ошибка старта");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room", roomId] });
    },
  });

  const allowMoveMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(apiUrl(`/rooms/${roomId}/allow-move`), {
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
      const res = await fetch(apiUrl(`/rooms/${roomId}/roll-dice`), {
        method: "POST",
        headers: authHeaders(token!),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.error ?? "Ход не разрешён");
      }
      return res.json() as Promise<{ diceValue: number; newPosition: number }>;
    },
    onSuccess: (data) => {
      setDiceValue(data.diceValue);
      setRolling(false);
      refetchPlayers();
    },
    onError: (e: any) => {
      Alert.alert("Ошибка", e.message);
      setRolling(false);
    },
  });

  useEffect(() => {
    if (!token || !roomId) return;
    joinMutation.mutate();
    joinRoom(roomId);
    return () => {
      leaveRoom(roomId);
    };
  }, [token, roomId]);

  useEffect(() => {
    if (lastDice) {
      setDiceValue(lastDice.diceValue);
      refetchPlayers();
    }
  }, [lastDice]);

  useEffect(() => {
    if (gameStarted) {
      qc.invalidateQueries({ queryKey: ["room", roomId] });
    }
  }, [gameStarted]);

  const handleRollDice = useCallback(async () => {
    if (rolling) return;
    setRolling(true);

    let frame = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      frame++;
      if (frame > 8) clearInterval(interval);
    }, 80);

    rollMutation.mutate();
  }, [rolling]);

  const players: GamePlayer[] = socketPlayers.length > 0 ? socketPlayers : (httpPlayers ?? []);
  const myPlayer = players.find(p => p.userId === user?.id);
  const isAdmin = user?.role === "admin";
  const isActive = room?.status === "active" || gameStarted;
  const canIMove = myPlayer?.canMove ?? false;
  const myPosition = myPlayer?.position ?? 0;

  if (roomLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#D4A017" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Game Board */}
        <GameBoard players={players} />

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Статус</Text>
            <Text style={[styles.statusValue, { color: isActive ? "#2ECC71" : "#F0C040" }]}>
              {isActive ? "🎮 Игра идёт" : "⏳ Ожидание"}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Моя позиция</Text>
            <Text style={styles.statusValue}>📍 Клетка {myPosition}</Text>
          </View>
          {diceValue !== null && (
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Последний бросок</Text>
              <Text style={[styles.statusValue, { fontSize: 24 }]}>{DICE_FACES[diceValue - 1]}</Text>
            </View>
          )}
        </View>

        {/* ADMIN PANEL */}
        {isAdmin && (
          <View style={styles.adminPanel}>
            <Text style={styles.sectionTitle}>👑 Панель администратора</Text>

            {!isActive && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => startMutation.mutate()}
                disabled={startMutation.isPending || players.length === 0}
              >
                {startMutation.isPending ? (
                  <ActivityIndicator color="#0B1426" />
                ) : (
                  <Text style={styles.startBtnText}>🚀 Начать игру</Text>
                )}
              </TouchableOpacity>
            )}

            {isActive && (
              <>
                <Text style={styles.subTitle}>Разрешить ход игроку:</Text>
                {players
                  .filter(p => p.userId !== user?.id)
                  .map(player => (
                    <TouchableOpacity
                      key={player.id}
                      style={[
                        styles.playerBtn,
                        player.canMove && styles.playerBtnActive,
                        allowedUserId === player.userId && styles.playerBtnGlowing,
                      ]}
                      onPress={() => allowMoveMutation.mutate(player.userId)}
                    >
                      <View style={[styles.colorDot, { backgroundColor: player.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playerBtnName}>{player.username}</Text>
                        <Text style={styles.playerBtnPos}>Клетка {player.position}</Text>
                      </View>
                      {player.canMove ? (
                        <Text style={styles.canMoveTag}>✅ Ходит</Text>
                      ) : (
                        <Text style={styles.allowTag}>Разрешить ход</Text>
                      )}
                    </TouchableOpacity>
                  ))}
              </>
            )}
          </View>
        )}

        {/* PLAYER PANEL */}
        {!isAdmin && (
          <View style={styles.playerPanel}>
            <Text style={styles.sectionTitle}>🎲 Твой ход</Text>

            {myPosition >= 60 ? (
              <View style={styles.winBanner}>
                <Text style={styles.winText}>🏆 Ты нашёл клад! Победа!</Text>
              </View>
            ) : canIMove ? (
              <TouchableOpacity
                style={[styles.diceBtn, rolling && styles.diceBtnRolling]}
                onPress={handleRollDice}
                disabled={rolling}
              >
                <Text style={styles.diceFace}>
                  {diceValue !== null ? DICE_FACES[diceValue - 1] : "🎲"}
                </Text>
                <Text style={styles.diceBtnText}>
                  {rolling ? "Бросаю..." : "Бросить кубик!"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.waitingBox}>
                <Text style={styles.waitingText}>
                  {isActive
                    ? "⏳ Жди разрешения администратора"
                    : "⏳ Игра ещё не началась"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Players List */}
        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>Участники</Text>
          {players.map(player => (
            <View
              key={player.id}
              style={[
                styles.playerRow,
                player.userId === user?.id && styles.playerRowMe,
                player.canMove && styles.playerRowActive,
              ]}
            >
              <View style={[styles.playerColorBar, { backgroundColor: player.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>
                  {player.username}
                  {player.userId === user?.id ? " (ты)" : ""}
                </Text>
                <Text style={styles.playerPosText}>Клетка {player.position} / 60</Text>
              </View>
              {player.canMove && <Text style={styles.activeIndicator}>🎲</Text>}
              {player.position >= 60 && <Text style={styles.winIndicator}>🏆</Text>}
            </View>
          ))}
          {players.length === 0 && (
            <Text style={styles.emptyText}>Игроки ещё не присоединились</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1426" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0B1426" },
  scroll: { padding: 8, paddingBottom: 40 },

  statusBar: {
    flexDirection: "row",
    backgroundColor: "#1A2744",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    gap: 4,
  },
  statusItem: { flex: 1, alignItems: "center" },
  statusLabel: { fontSize: 11, color: "#6B7A9E", marginBottom: 2 },
  statusValue: { fontSize: 14, fontWeight: "700", color: "#F5E6C8" },

  adminPanel: {
    backgroundColor: "#1A2744",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#D4A01733",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#D4A017",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subTitle: { fontSize: 13, color: "#A89060", marginBottom: 8 },

  startBtn: {
    backgroundColor: "#2ECC71",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#2ECC71",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: { color: "#000", fontSize: 16, fontWeight: "800" },

  playerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#243358",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2E4070",
    gap: 10,
  },
  playerBtnActive: { borderColor: "#2ECC71", backgroundColor: "#1A3A2A" },
  playerBtnGlowing: {
    borderColor: "#D4A017",
    shadowColor: "#D4A017",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  playerBtnName: { fontSize: 15, fontWeight: "700", color: "#F5E6C8" },
  playerBtnPos: { fontSize: 12, color: "#A89060" },
  canMoveTag: { fontSize: 12, color: "#2ECC71", fontWeight: "700" },
  allowTag: {
    fontSize: 12,
    color: "#D4A017",
    borderWidth: 1,
    borderColor: "#D4A017",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  playerPanel: {
    backgroundColor: "#1A2744",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2E407099",
  },

  diceBtn: {
    backgroundColor: "#D4A017",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 48,
    alignItems: "center",
    shadowColor: "#D4A017",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
    width: "100%",
  },
  diceBtnRolling: { opacity: 0.8 },
  diceFace: { fontSize: 56, marginBottom: 4 },
  diceBtnText: { fontSize: 18, fontWeight: "800", color: "#0B1426" },

  waitingBox: {
    backgroundColor: "#243358",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    width: "100%",
  },
  waitingText: { color: "#A89060", fontSize: 15, textAlign: "center" },

  winBanner: {
    backgroundColor: "#1A3A1A",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    width: "100%",
    borderWidth: 2,
    borderColor: "#2ECC71",
  },
  winText: { color: "#2ECC71", fontSize: 20, fontWeight: "800", textAlign: "center" },

  playersSection: {
    backgroundColor: "#1A2744",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2E4070",
    gap: 10,
  },
  playerRowMe: { backgroundColor: "#243358", borderRadius: 8, paddingHorizontal: 8 },
  playerRowActive: { backgroundColor: "#1A3A2A", borderRadius: 8, paddingHorizontal: 8 },
  playerColorBar: { width: 4, height: 36, borderRadius: 2 },
  playerName: { fontSize: 15, fontWeight: "700", color: "#F5E6C8" },
  playerPosText: { fontSize: 12, color: "#A89060", marginTop: 2 },
  activeIndicator: { fontSize: 20 },
  winIndicator: { fontSize: 20 },
  emptyText: { color: "#6B7A9E", textAlign: "center", paddingVertical: 20 },
});
