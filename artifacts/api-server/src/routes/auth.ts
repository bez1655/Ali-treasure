import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createToken } from "../lib/tokenStore";

const router: IRouter = Router();

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
  }
}

// Username rules:
//  - admin: plain word, checked against existing accounts only
//  - player: must start with @, auto-registered on first login
function validatePlayerUsername(username: string): string | null {
  if (!username.startsWith("@")) return "Логин игрока должен начинаться с @";
  if (username.length < 2) return "Слишком короткий логин";
  if (username.length > 33) return "Слишком длинный логин (макс. 32 символа)";
  const name = username.slice(1);
  if (!/^[a-zA-Z0-9_а-яА-ЯёЁ]+$/.test(name)) return "Логин может содержать буквы, цифры и _";
  return null;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ error: "Введите логин и пароль" });
    return;
  }

  const trimmed = username.trim();
  const isPlayerLogin = trimmed.startsWith("@");

  // ── PLAYER: auto-register on first login ─────────────────────────────────
  if (isPlayerLogin) {
    const err = validatePlayerUsername(trimmed);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, trimmed));

    if (!existing) {
      // First time — create the account
      const hash = await bcrypt.hash(password, 10);
      const [newUser] = await db
        .insert(usersTable)
        .values({ username: trimmed, passwordHash: hash, role: "player" })
        .returning();

      const token = createToken(newUser.id, newUser.username, newUser.role);
      res.json({ user: { id: newUser.id, username: newUser.username, role: newUser.role }, token });
      return;
    }

    // Returning player — check password
    const valid = await bcrypt.compare(password, existing.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Неверный пароль" });
      return;
    }

    const token = createToken(existing.id, existing.username, existing.role);
    res.json({ user: { id: existing.id, username: existing.username, role: existing.role }, token });
    return;
  }

  // ── ADMIN: normal password check ─────────────────────────────────────────
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, trimmed));

  if (!user) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;

  const token = createToken(user.id, user.username, user.role);
  res.json({ user: { id: user.id, username: user.username, role: user.role }, token });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const { validateToken } = await import("../lib/tokenStore");
    const data = validateToken(auth.slice(7));
    if (data) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, data.userId));
      if (user) {
        res.json({ id: user.id, username: user.username, role: user.role });
        return;
      }
    }
  }

  if (!req.session.userId) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user) {
    res.status(401).json({ error: "Пользователь не найден" });
    return;
  }

  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
