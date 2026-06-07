# АЛИ-БАБА И 40 КЛАДОВ — Мобильная игра

Мультиплеерная настольная игра в арабском стиле: 60 клеток, бросок кубика, роли Администратора и Игрока. Весь интерфейс на русском языке.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API сервер (port 8080/5000)
- `pnpm --filter @workspace/ali-baba-mobile run dev` — Expo мобильное приложение
- `pnpm run typecheck` — проверка типов
- `pnpm --filter @workspace/db run push` — применить схему БД (только dev)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Socket.io (real-time) — `/api/socket.io` path
- DB: PostgreSQL + Drizzle ORM
- Mobile: Expo (React Native) + expo-router
- Auth: Bearer token (хранится в AsyncStorage на мобильном)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/` — Express backend + Socket.io
- `artifacts/api-server/src/routes/auth.ts` — аутентификация (login/me/logout)
- `artifacts/api-server/src/routes/rooms.ts` — комнаты, allow-move, roll-dice
- `artifacts/api-server/src/lib/socket.ts` — Socket.io события
- `artifacts/api-server/src/lib/tokenStore.ts` — in-memory Bearer токены
- `artifacts/ali-baba-mobile/app/` — экраны (login, rooms, room/[id])
- `artifacts/ali-baba-mobile/contexts/` — AuthContext, SocketContext
- `artifacts/ali-baba-mobile/components/GameBoard.tsx` — игровое поле 60 клеток
- `artifacts/ali-baba-mobile/assets/images/board.png` — изображение игрового поля
- `lib/db/src/schema/` — users, rooms, game_players таблицы

## Architecture decisions

- Bearer token авторизация вместо сессий (cookies в React Native ненадёжны)
- tokenStore — in-memory Map (достаточно для игры, перезагрузка сбрасывает сессии)
- Socket.io на `/api/socket.io` path через общий реверс-прокси
- Игровое поле — изображение board.png с оверлеем токенов игроков (Animated API)
- 60 клеток = жёстко заданные координаты [x%, y%] в компоненте GameBoard

## Product

- Экран входа: логин + пароль, тема арабских ночей
- Список комнат: администратор создаёт, игроки присоединяются
- Игровое поле: реальное изображение поля + анимированные токены игроков
- Администратор: разрешает ход каждому игроку, запускает игру
- Игрок: бросает кубик когда разрешено, видит свою позицию
- Финиш: клетка 60 (Пещера чудес)

## User preferences

- Весь интерфейс на русском языке
- Тема: Арабские ночи (midnight blue #0B1426, gold #D4A017)
- Игровое поле должно соответствовать изображению из attached_assets/1780826394940_1780854437068.png
- Роли: admin (пароль: Listva_v_besedke), player (пароль: player123)
- Тестовые аккаунты: admin / игрок1 (player123) / игрок2 (player123)

## Gotchas

- bcrypt — нативный модуль, externalized в esbuild; `pnpm approve-builds` нужен
- tokenStore — in-memory, сбрасывается при рестарте сервера (логаут автоматически)
- Координаты клеток в GameBoard.tsx — приближённые, можно уточнить позже
- Socket.io транспорты: ["websocket", "polling"] для совместимости с Expo Go
- Expo workflow не имеет ensurePreviewReachable (убрано из artifact.toml)

## Pointers

- DB схема: `lib/db/src/schema/`
- Socket.io events: `join_room`, `allow_move`, `dice_rolled`, `game_state`, `game_started`
- API paths: все через `/api/` prefix
