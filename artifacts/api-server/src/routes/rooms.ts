import { Router, type IRouter } from "express";
import { db, roomsTable, gamePlayersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateRoomBody,
  GetRoomParams,
  GetRoomPlayersParams,
  JoinRoomParams,
  StartGameParams,
} from "@workspace/api-zod";
import { emitAllowMove, emitDiceRolled, emitGameStarted, io } from "../lib/socket";
import { validateToken } from "../lib/tokenStore";

const router: IRouter = Router();

const PLAYER_COLORS = [
  "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1",
  "#96CEB4", "#DDA0DD", "#FF8C00", "#20B2AA",
];

function getAuthUser(req: any): { userId: number; username: string; role: string } | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return validateToken(auth.slice(7));
  }
  if (req.session?.userId) {
    return { userId: req.session.userId, username: req.session.username, role: req.session.role };
  }
  return null;
}

function requireAuth(req: any, res: any, next: any) {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }
  req.authUser = user;
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Только администратор" });
    return;
  }
  req.authUser = user;
  next();
}

function serializePlayer(p: any) {
  return {
    id: p.id,
    roomId: p.roomId,
    userId: p.userId,
    username: p.username,
    position: p.position,
    color: p.color,
    canMove: p.canMove,
  };
}

router.get("/rooms", requireAuth, async (_req, res): Promise<void> => {
  const rooms = await db.select().from(roomsTable).orderBy(roomsTable.createdAt);
  res.json(rooms.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/rooms", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [room] = await db
    .insert(roomsTable)
    .values({ name: parsed.data.name })
    .returning();

  res.status(201).json({
    id: room.id,
    name: room.name,
    status: room.status,
    createdAt: room.createdAt.toISOString(),
  });
});

router.get("/rooms/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }

  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, params.data.id));

  if (!room) {
    res.status(404).json({ error: "Комната не найдена" });
    return;
  }

  const players = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.roomId, room.id));

  res.json({
    id: room.id,
    name: room.name,
    status: room.status,
    createdAt: room.createdAt.toISOString(),
    players: players.map(serializePlayer),
  });
});

router.get("/rooms/:id/players", requireAuth, async (req, res): Promise<void> => {
  const params = GetRoomPlayersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }

  const players = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.roomId, params.data.id));

  res.json(players.map(serializePlayer));
});

router.post("/rooms/:id/join", requireAuth, async (req, res): Promise<void> => {
  const params = JoinRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }

  const { userId, username } = (req as any).authUser;

  const existing = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.roomId, params.data.id));

  const alreadyIn = existing.find(p => p.userId === userId);
  if (alreadyIn) {
    res.json(serializePlayer(alreadyIn));
    return;
  }

  const colorIndex = existing.length % PLAYER_COLORS.length;
  const color = PLAYER_COLORS[colorIndex];

  const [player] = await db
    .insert(gamePlayersTable)
    .values({ roomId: params.data.id, userId, username, color })
    .returning();

  if (io) {
    const allPlayers = await db
      .select()
      .from(gamePlayersTable)
      .where(eq(gamePlayersTable.roomId, params.data.id));
    io.to(`room:${params.data.id}`).emit("game_state", { players: allPlayers.map(serializePlayer) });
  }

  res.json(serializePlayer(player));
});

router.post("/rooms/:id/start", requireAdmin, async (req, res): Promise<void> => {
  const params = StartGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }

  const [room] = await db
    .update(roomsTable)
    .set({ status: "active" })
    .where(eq(roomsTable.id, params.data.id))
    .returning();

  if (!room) {
    res.status(404).json({ error: "Комната не найдена" });
    return;
  }

  await emitGameStarted(params.data.id);

  res.json({
    id: room.id,
    name: room.name,
    status: room.status,
    createdAt: room.createdAt.toISOString(),
  });
});

router.post("/rooms/:id/allow-move", requireAdmin, async (req, res): Promise<void> => {
  const roomId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "userId обязателен" });
    return;
  }

  await db
    .update(gamePlayersTable)
    .set({ canMove: false })
    .where(eq(gamePlayersTable.roomId, roomId));

  await db
    .update(gamePlayersTable)
    .set({ canMove: true })
    .where(eq(gamePlayersTable.userId, Number(userId)));

  await emitAllowMove(roomId, Number(userId));
  res.json({ ok: true });
});

router.post("/rooms/:id/roll-dice", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { userId } = (req as any).authUser;

  const [player] = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.userId, userId));

  if (!player || !player.canMove) {
    res.status(403).json({ error: "Ход не разрешён" });
    return;
  }

  const diceValue = Math.floor(Math.random() * 6) + 1;
  const newPosition = Math.min(player.position + diceValue, 60);

  await db
    .update(gamePlayersTable)
    .set({ position: newPosition, canMove: false })
    .where(eq(gamePlayersTable.userId, userId));

  await emitDiceRolled(roomId, userId, diceValue, newPosition);
  res.json({ diceValue, newPosition });
});

export default router;
