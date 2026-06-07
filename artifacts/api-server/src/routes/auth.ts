import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { createToken } from "../lib/tokenStore";

const router: IRouter = Router();

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
  }
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

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

  res.json({
    user: { id: user.id, username: user.username, role: user.role },
    token,
  });
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
