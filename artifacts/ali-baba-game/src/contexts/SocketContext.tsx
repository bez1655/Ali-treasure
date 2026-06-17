import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface GamePlayer {
  id: number;
  roomId: number;
  userId: number;
  username: string;
  position: number;
  color: string;
  canMove: boolean;
}

interface SocketContextType {
  joinRoom: (roomId: number) => void;
  leaveRoom: (roomId: number) => void;
  players: GamePlayer[];
  allowedUserId: number | null;
  lastDice: { userId: number; diceValue: number; newPosition: number } | null;
  gameStarted: boolean;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children, token }: { children: React.ReactNode; token: string | null }) {
  const socketRef = useRef<Socket | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [allowedUserId, setAllowedUserId] = useState<number | null>(null);
  const [lastDice, setLastDice] = useState<{ userId: number; diceValue: number; newPosition: number } | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = io("/", {
      path: "/api/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("game_state", (data: { players: GamePlayer[] }) => setPlayers(data.players));
    socket.on("allow_move", (data: { userId: number }) => {
      setAllowedUserId(data.userId);
      setPlayers(prev => prev.map(p => ({ ...p, canMove: p.userId === data.userId })));
    });
    socket.on("dice_rolled", (data: { userId: number; diceValue: number; newPosition: number }) => {
      setLastDice(data);
      setAllowedUserId(null);
      setPlayers(prev => prev.map(p =>
        p.userId === data.userId ? { ...p, position: data.newPosition, canMove: false } : p
      ));
    });
    socket.on("game_started", () => setGameStarted(true));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const joinRoom = useCallback((roomId: number) => {
    socketRef.current?.emit("join_room", roomId);
  }, []);

  const leaveRoom = useCallback((roomId: number) => {
    socketRef.current?.emit("leave_room", roomId);
    setPlayers([]);
    setAllowedUserId(null);
    setGameStarted(false);
  }, []);

  return (
    <SocketContext.Provider value={{ joinRoom, leaveRoom, players, allowedUserId, lastDice, gameStarted }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
}
