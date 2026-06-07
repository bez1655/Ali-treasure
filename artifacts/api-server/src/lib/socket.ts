import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { db, gamePlayersTable, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export let io: SocketIOServer;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join_room", async (roomId: number) => {
      const room = `room:${roomId}`;
      socket.join(room);
      logger.info({ socketId: socket.id, roomId }, "Socket joined room");

      const players = await db
        .select()
        .from(gamePlayersTable)
        .where(eq(gamePlayersTable.roomId, roomId));

      socket.emit("game_state", { players });
    });

    socket.on("leave_room", (roomId: number) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

export async function emitAllowMove(roomId: number, userId: number): Promise<void> {
  if (!io) return;
  io.to(`room:${roomId}`).emit("allow_move", { userId });
}

export async function emitDiceRolled(
  roomId: number,
  userId: number,
  diceValue: number,
  newPosition: number,
): Promise<void> {
  if (!io) return;
  const players = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.roomId, roomId));

  io.to(`room:${roomId}`).emit("dice_rolled", {
    userId,
    diceValue,
    newPosition,
  });
  io.to(`room:${roomId}`).emit("game_state", { players });
}

export async function emitGameStarted(roomId: number): Promise<void> {
  if (!io) return;
  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
  io.to(`room:${roomId}`).emit("game_started", { room });
}
