import { Router, type IRouter } from "express";
import { db, roomsTable, gamePlayersTable, gameMovesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }
  req.authUser = user;
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }
  if (user.role !== "admin") { res.status(403).json({ error: "Только администратор" }); return; }
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

function serializeRoom(r: any) {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
  };
}

// ── Rooms ─────────────────────────────────────────────────────────────────

router.get("/rooms", requireAuth, async (_req, res): Promise<void> => {
  const rooms = await db.select().from(roomsTable).orderBy(desc(roomsTable.createdAt));
  res.json(rooms.map(serializeRoom));
});

router.post("/rooms", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [room] = await db.insert(roomsTable).values({ name: parsed.data.name }).returning();
  res.status(201).json(serializeRoom(room));
});

router.get("/rooms/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, params.data.id));
  if (!room) { res.status(404).json({ error: "Комната не найдена" }); return; }

  const players = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.roomId, room.id));

  res.json({ ...serializeRoom(room), players: players.map(serializePlayer) });
});

router.get("/rooms/:id/players", requireAuth, async (req, res): Promise<void> => {
  const params = GetRoomPlayersParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Неверный ID" }); return; }

  const players = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.roomId, params.data.id));

  res.json(players.map(serializePlayer));
});

// ── History ───────────────────────────────────────────────────────────────

router.get("/rooms/:id/history", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!roomId) { res.status(400).json({ error: "Неверный ID" }); return; }

  const moves = await db
    .select()
    .from(gameMovesTable)
    .where(eq(gameMovesTable.roomId, roomId))
    .orderBy(gameMovesTable.movedAt);

  res.json(moves.map(m => ({
    id: m.id,
    userId: m.userId,
    username: m.username,
    diceValue: m.diceValue,
    fromPosition: m.fromPosition,
    toPosition: m.toPosition,
    movedAt: m.movedAt.toISOString(),
  })));
});

// ── Join ──────────────────────────────────────────────────────────────────

router.post("/rooms/:id/join", requireAuth, async (req, res): Promise<void> => {
  const params = JoinRoomParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Неверный ID" }); return; }

  const { userId, username } = (req as any).authUser;

  const existing = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.roomId, params.data.id));

  const alreadyIn = existing.find(p => p.userId === userId);
  if (alreadyIn) { res.json(serializePlayer(alreadyIn)); return; }

  const color = PLAYER_COLORS[existing.length % PLAYER_COLORS.length];
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

// ── Start ─────────────────────────────────────────────────────────────────

router.post("/rooms/:id/start", requireAdmin, async (req, res): Promise<void> => {
  const params = StartGameParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [room] = await db
    .update(roomsTable)
    .set({ status: "active" })
    .where(eq(roomsTable.id, params.data.id))
    .returning();

  if (!room) { res.status(404).json({ error: "Комната не найдена" }); return; }

  await emitGameStarted(params.data.id);
  res.json(serializeRoom(room));
});

// ── Allow move ────────────────────────────────────────────────────────────

router.post("/rooms/:id/allow-move", requireAdmin, async (req, res): Promise<void> => {
  const roomId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { userId } = req.body;
  if (!userId) { res.status(400).json({ error: "userId обязателен" }); return; }

  await db.update(gamePlayersTable).set({ canMove: false }).where(eq(gamePlayersTable.roomId, roomId));
  await db.update(gamePlayersTable).set({ canMove: true }).where(eq(gamePlayersTable.userId, Number(userId)));

  await emitAllowMove(roomId, Number(userId));
  res.json({ ok: true });
});

// ── Roll dice ─────────────────────────────────────────────────────────────

router.post("/rooms/:id/roll-dice", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { userId, username } = (req as any).authUser;

  const [player] = await db
    .select()
    .from(gamePlayersTable)
    .where(eq(gamePlayersTable.userId, userId));

  if (!player || !player.canMove) {
    res.status(403).json({ error: "Ход не разрешён" });
    return;
  }

  const diceValue = Math.floor(Math.random() * 6) + 1;
  const fromPosition = player.position;
  const toPosition = Math.min(fromPosition + diceValue, 60);

  await db
    .update(gamePlayersTable)
    .set({ position: toPosition, canMove: false })
    .where(eq(gamePlayersTable.userId, userId));

  // Save move to history
  await db.insert(gameMovesTable).values({
    roomId,
    userId,
    username,
    diceValue,
    fromPosition,
    toPosition,
  });

  // Mark room as finished if player reached 60
  if (toPosition >= 60) {
    await db
      .update(roomsTable)
      .set({ status: "finished", finishedAt: new Date() })
      .where(eq(roomsTable.id, roomId));
  }

  await emitDiceRolled(roomId, userId, diceValue, toPosition);
  res.json({ diceValue, newPosition: toPosition });
});

export default router;
