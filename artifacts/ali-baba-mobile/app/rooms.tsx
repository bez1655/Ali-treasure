import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost";

function apiUrl(path: string) {
  return `https://${DOMAIN}/api${path}`;
}

interface Room {
  id: number;
  name: string;
  status: "waiting" | "active" | "finished";
}

async function fetchRooms(token: string): Promise<Room[]> {
  const res = await fetch(apiUrl("/rooms"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Ошибка загрузки");
  return res.json();
}

async function createRoom(token: string, name: string): Promise<Room> {
  const res = await fetch(apiUrl("/rooms"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Ошибка создания комнаты");
  return res.json();
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

export default function RoomsScreen() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [newRoomName, setNewRoomName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: rooms, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => fetchRooms(token!),
    enabled: !!token,
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createRoom(token!, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setNewRoomName("");
      setShowCreate(false);
    },
    onError: (e: any) => Alert.alert("Ошибка", e.message),
  });

  const handleCreate = () => {
    if (!newRoomName.trim()) return;
    createMutation.mutate(newRoomName.trim());
  };

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout, router]);

  const renderRoom = ({ item }: { item: Room }) => (
    <TouchableOpacity
      style={styles.roomCard}
      onPress={() => router.push(`/room/${item.id}`)}
    >
      <View style={styles.roomInfo}>
        <Text style={styles.roomName}>{item.name}</Text>
        <Text style={[styles.roomStatus, { color: STATUS_COLOR[item.status] ?? "#888" }]}>
          {STATUS_LABEL[item.status] ?? item.status}
        </Text>
      </View>
      <Text style={styles.roomArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Привет, {user?.username}!</Text>
          <Text style={styles.role}>{user?.role === "admin" ? "👑 Администратор" : "🎲 Игрок"}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {user?.role === "admin" && (
        <View style={styles.adminSection}>
          {showCreate ? (
            <View style={styles.createForm}>
              <TextInput
                style={styles.input}
                value={newRoomName}
                onChangeText={setNewRoomName}
                placeholder="Название комнаты"
                placeholderTextColor="#6B7A9E"
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowCreate(false)}
                >
                  <Text style={styles.cancelText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createBtn, !newRoomName.trim() && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={!newRoomName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#0B1426" size="small" />
                  ) : (
                    <Text style={styles.createBtnText}>Создать</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.newRoomBtn} onPress={() => setShowCreate(true)}>
              <Text style={styles.newRoomText}>＋ Создать комнату</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Комнаты игры</Text>

      {isLoading ? (
        <ActivityIndicator color="#D4A017" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rooms ?? []}
          keyExtractor={(r) => String(r.id)}
          renderItem={renderRoom}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#D4A017"
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Нет доступных комнат</Text>
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1426" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2744",
  },
  welcome: { fontSize: 18, fontWeight: "700", color: "#F5E6C8" },
  role: { fontSize: 13, color: "#A89060", marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2E4070",
    borderRadius: 8,
  },
  logoutText: { color: "#A89060", fontSize: 13 },
  adminSection: { paddingHorizontal: 20, paddingVertical: 12 },
  newRoomBtn: {
    backgroundColor: "#1A2744",
    borderWidth: 1,
    borderColor: "#D4A017",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  newRoomText: { color: "#D4A017", fontSize: 16, fontWeight: "700" },
  createForm: { gap: 10 },
  input: {
    backgroundColor: "#1A2744",
    borderWidth: 1,
    borderColor: "#2E4070",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#F5E6C8",
  },
  createActions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#1A2744",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2E4070",
  },
  cancelText: { color: "#A89060", fontSize: 15 },
  createBtn: {
    flex: 2,
    backgroundColor: "#D4A017",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  createBtnText: { color: "#0B1426", fontSize: 15, fontWeight: "700" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#A89060",
    paddingHorizontal: 20,
    paddingVertical: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  roomCard: {
    backgroundColor: "#1A2744",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2E4070",
  },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 17, fontWeight: "700", color: "#F5E6C8", marginBottom: 4 },
  roomStatus: { fontSize: 13 },
  roomArrow: { fontSize: 24, color: "#D4A017", marginLeft: 8 },
  emptyText: { textAlign: "center", color: "#6B7A9E", marginTop: 60, fontSize: 16 },
});
