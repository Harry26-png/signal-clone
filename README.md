# Signal Clone: Secure Messaging Platform

**Live demo:** https://signal-clone-beta.vercel.app — sign in with any demo account (code `123456`)
**API:** https://signal-clone-api-0ibc.onrender.com ([docs](https://signal-clone-api-0ibc.onrender.com/docs))

> The API runs on Render's free tier, which sleeps when idle. A GitHub Actions job (`.github/workflows/keep-alive.yml`) pings it every 5 minutes to keep it warm. If it was asleep anyway, the site shows a "Waking up the server" notice, and the first request can take 30–60 seconds.

A full-stack clone of the Signal messenger built for the Scaler SDE Fullstack assignment. It covers mocked phone registration, contacts, 1:1 and group chats, real-time delivery over WebSockets, Signal-style sent/delivered/read ticks, typing indicators, presence, and admin controls for groups. The UI follows Signal Desktop's layout and look, with light and dark themes.

| | |
|---|---|
| **Frontend** | Next.js 15 (App Router) · React 19 · TypeScript · Zustand · CSS Modules |
| **Backend** | Python 3.10+ · FastAPI · SQLAlchemy 2 · Pydantic v2 |
| **Database** | SQLite (WAL mode, foreign keys enforced) |
| **Real-time** | Native WebSockets (FastAPI ⇄ browser), single multiplexed channel per tab |

---

## Quick start

### Prerequisites
- Python **3.10+**
- Node.js **18.18+** (tested on Node 24)

### 1. Backend (http://localhost:8000)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On first start the backend creates `signal.db` and **seeds demo data** automatically. To reset the data:

```bash
python -m app.seed --reset
```

Interactive API docs are served at http://localhost:8000/docs.

### 2. Frontend (http://localhost:3000)

```bash
cd frontend
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

### 3. Sign in

Phone verification is **mocked**: every number accepts the code **`123456`**. The login screen has one-click demo accounts:

| Name | Phone | Notes |
|---|---|---|
| Alice Johnson | +1 555-010-0001 | Most seeded chats, including unread ones; a regular member of both groups |
| Bob Martinez | +1 555-010-0002 | Admin of "Weekend Hiking 🥾" |
| Carol Nguyen | +1 555-010-0003 | |
| David Kim | +1 555-010-0004 | Admin of "Project Phoenix" |
| Emma, Frank, Grace, Henry | +1 555-010-0005 … 0008 | Henry is *not* in Alice's contacts, so you can demo "add contact" |

Entering any other number registers a new account and opens the profile setup step (name and avatar).

> **Tip:** to see real-time features, open two browsers (or a normal and a private window), sign in as Alice in one and Bob in the other, and chat. Typing indicators, ticks, reactions, presence and group changes update live.

### Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

The suite covers auth, registration, session invalidation, conversation ordering, contact lookup, **WebSocket delivery → delivered → read receipts**, typing events, idempotent sends, group admin permissions, last-admin promotion and access control.

```bash
cd frontend
npm run typecheck && npm run build
```

---

## Features

### Core (must have)
| Requirement | Implementation |
|---|---|
| Register with phone, fixed OTP | `PhoneStep` → `OtpStep` (6-box code input, paste support) → `ProfileStep`; backend `POST /api/auth/otp`, `/verify` |
| Display name & avatar | First/last name, photo upload **or** one of Signal's 12 avatar colours (initials) |
| Login / logout / session persistence | Opaque bearer token stored in `sessions` table and `localStorage`; restored on reload; logout revokes the server session |
| Conversation list sorted by activity | Ordered by `conversations.last_activity_at`, updated on every message |
| Search conversations & contacts | Sidebar search shows "Chats" and "Contacts" sections; `Ctrl+F` focuses it |
| Add a new contact | *New chat → Find by phone number / username* → **Add to contacts** |
| Unread indicators & last-message preview | Unread badge per chat, total in nav rail and tab title, "N Unread Messages" divider; preview shows sender, status tick, drafts, typing |
| Online / last seen | Real presence from live WebSocket connections; "Online" / "Last seen 5 minutes ago" in header and details, green dot on avatars |
| Real-time 1:1 messaging | REST to send, WebSocket fan-out to recipients |
| Timestamps | "Now", "5m", "10:42 AM"; day dividers "Today", "Yesterday", "Monday", "Sep 8" |
| Sending / sent / delivered / read | Optimistic **sending** (dashed circle) → **sent** (✓ circle) → **delivered** (two circles) → **read** (two filled circles), aggregated from per-recipient receipts |
| Typing indicators | Throttled typing events, animated bubble in the timeline, "typing…" in header and chat list |
| Messages persisted | All messages, receipts and reactions are stored in SQLite |
| Groups: create, send/receive, view members | Two-step "Add members → Name this group" flow, sender names and avatars in group bubbles |
| Add/remove members, admin controls | Admin-only add/remove/promote/demote; anyone can leave; the last admin leaving auto-promotes the longest-standing member; system timeline events ("Alice added Bob.") |
| Signal look & feel | Nav rail (Chats / Calls / Stories), conversation list + chat pane, Signal colours (ultramarine `#2C6BED`), bubble clustering with tightened corners, Inter font, modals, menus, toasts |
| Settings placeholders | Profile (functional), Appearance (functional theme), Notifications (functional browser notifications), General / Chats / Privacy / Linked devices placeholders |

### Placeholders ("Coming soon")
Voice/video calls, Stories, Linked devices, voice messages. **End-to-end encryption is simulated**: the UI has the encryption notices and a deterministic mock "safety number" with a QR-style code, but messages are stored in plain text.

### Bonus features implemented
- **Attachments**: images (inline, lightbox) and files (download), via the picker or by pasting from the clipboard
- **Reactions**: Signal's six default emoji, one reaction per user, live updates
- **Reply / quoted messages**: quoted preview in the composer and the bubble; click a quote to jump to the original
- **Disappearing messages**: per-chat timer (30 s to 4 weeks). Messages get an `expires_at`, a server sweeper deletes them and notifies clients, and clients also hide them locally on time
- **Dark mode**: System / Light / Dark, applied before first paint (no flash)
- **Responsive**: desktop (3 columns), tablet (narrower list), mobile (single pane with a bottom tab bar)
- **Keyboard shortcuts**: `Ctrl+N` new chat, `Ctrl+Shift+G` new group, `Ctrl+F` search, `Alt+↑/↓` switch chat, `Ctrl+,` settings, `Ctrl+/` shortcut list, `Esc` closes things, `Enter` / `Shift+Enter`

---

## Architecture

```
┌──────────────────────── Browser (Next.js, client-rendered SPA) ────────────────────────┐
│  components/  (sidebar · chat · details · modals · settings · onboarding · common)     │
│        │ read state / call actions                                                     │
│  store/  Zustand: session (auth) · chat (normalized users/conversations/timelines)     │
│          · ui (navigation, modals, toasts, prefs)                                      │
│        │                         ▲ server events                                       │
│  lib/api.ts (REST, bearer token)  lib/socket.ts (WebSocket, heartbeat, reconnect)      │
└────────┼─────────────────────────┼─────────────────────────────────────────────────────┘
         │ HTTPS /api/*            │ WSS /ws?token=…
┌────────▼─────────────────────────┴──────────────── FastAPI ─────────────────────────────┐
│  routers/   thin HTTP/WS layer: validation, auth dependency, dispatch of events         │
│  services/  business logic: users · conversations · messages · membership · attachments │
│             (raise domain errors → mapped to HTTP codes; return "deliveries")           │
│  realtime.py  ConnectionManager: user_id → open sockets; fan-out                        │
│  tasks.py     disappearing-message sweeper (asyncio background task)                    │
│  models.py    SQLAlchemy ORM ──► SQLite                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key design decisions

- **REST for commands, WebSocket for events.** Sending a message, marking a chat read, group changes and so on go through REST, which gives validation, status codes and a response the client can reconcile. The server then pushes events over the socket. The socket only carries ephemeral client signals (`typing`, `delivered` acks, `ping`).
- **Services return "deliveries".** A service function commits its changes and returns a list of `(recipient_ids, event)` pairs. Routes hand them to FastAPI `BackgroundTasks`, so events go out only *after* the response and the commit. This keeps business logic free of transport concerns and easy to test.
- **Receipts as rows, not columns.** `message_receipts` has one row per *recipient* with `delivered_at` and `read_at`. The sender's tick is an aggregate: `read` when every recipient has read it, `delivered` when every recipient has received it, otherwise `sent`. The same rows give exact per-user unread counts (`read_at IS NULL`), and this works the same for groups.
- **Delivered really means delivered.** A message is marked delivered when the recipient's client acknowledges it over the socket, or for everything pending when a client connects. It is marked read when the chat is open and the tab is visible.
- **Optimistic UI with idempotency.** The client inserts a `sending` bubble with a UUID `client_id`. The server enforces `UNIQUE(sender_id, client_id)`, so retries never duplicate a message. The client reconciles the REST response and the WS echo by `client_id`, and statuses never move backwards when events arrive out of order.
- **Viewer-specific data isn't broadcast.** Unread counts and the viewer's role differ per user, so `conversation.updated` is only a signal and each client re-fetches `GET /conversations/{id}`.
- **System events are structured.** Group timeline entries are stored as JSON (`{"event":"members_added","user_ids":[2]}`) and phrased on the client from the viewer's perspective ("You added Bob." vs "Alice added Bob.").
- **Normalized client state.** Users live in one map. Conversations reference members by id, so a presence or profile update re-renders every place that user appears.

### Real-time protocol (`/ws?token=…`)

| Direction | Event | Payload |
|---|---|---|
| S → C | `message.new` | full message |
| S → C | `message.status` | `[{message_id, conversation_id, status}]` (sent to the sender) |
| S → C | `message.reactions` | `conversation_id, message_id, reactions[]` |
| S → C | `message.deleted` | `conversation_id, message_ids[]` (disappearing) |
| S → C | `conversation.updated` / `.removed` / `.read` | `conversation_id` |
| S → C | `typing` | `conversation_id, user_id, is_typing` |
| S → C | `presence` | `user_id, online, last_seen_at` |
| S → C | `user.updated` | profile |
| C → S | `typing` | `conversation_id, is_typing` |
| C → S | `delivered` | `message_ids[]` |
| C → S | `ping` | heartbeat (every 25 s) → `pong` |

The client reconnects with exponential backoff and, after reconnecting, re-syncs conversations and the open timeline to catch up on anything missed.

---

## Database schema

```
users ──┬──< sessions
        ├──< contacts >── users              (owner → contact; directional address book)
        ├──< conversation_members >── conversations
        ├──< messages >── conversations      (messages.reply_to_id → messages, self-reference)
        ├──< message_receipts >── messages   (one row per recipient)
        ├──< reactions >── messages
        └──< attachments <── messages.attachment_id
```

| Table | Columns | Constraints / indexes |
|---|---|---|
| **users** | `id` PK, `phone`, `username`, `display_name`, `about`, `avatar_color`, `avatar_path`, `last_seen_at`, `created_at` | `phone` UNIQUE, `username` UNIQUE |
| **sessions** | `id` PK, `token`, `user_id` FK→users, `created_at` | `token` UNIQUE; CASCADE on user delete |
| **contacts** | `id` PK, `owner_id` FK→users, `contact_user_id` FK→users, `created_at` | UNIQUE(`owner_id`,`contact_user_id`), CHECK owner ≠ contact |
| **conversations** | `id` PK, `kind` (`direct`/`group`), `title`, `description`, `avatar_color`, `direct_key`, `disappearing_seconds`, `created_by_id` FK→users, `created_at`, `last_activity_at` | CHECK kind; `direct_key` UNIQUE ("lowId:highId", so one chat per pair); index on `last_activity_at` |
| **conversation_members** | `conversation_id` FK, `user_id` FK, `role` (`admin`/`member`), `joined_at` | composite PK; CHECK role; CASCADE |
| **messages** | `id` PK, `conversation_id` FK, `sender_id` FK, `kind` (`text`/`system`), `body`, `client_id`, `reply_to_id` FK→messages, `attachment_id` FK→attachments, `created_at`, `expires_at` | UNIQUE(`sender_id`,`client_id`) for idempotency; index (`conversation_id`,`id`) for paging; index on `expires_at` for the sweeper |
| **message_receipts** | `message_id` FK, `user_id` FK, `delivered_at`, `read_at` | composite PK; index (`user_id`,`read_at`) for unread counts |
| **reactions** | `message_id` FK, `user_id` FK, `emoji`, `created_at` | composite PK, so one reaction per user per message |
| **attachments** | `id` (uuid hex) PK, `uploader_id` FK, `file_name`, `content_type`, `size_bytes`, `storage_name`, `created_at` | files stored on disk under `UPLOAD_DIR` |

SQLite is opened with `PRAGMA foreign_keys=ON` (so `ON DELETE CASCADE / SET NULL` work) and `journal_mode=WAL` (readers don't block the writer).

---

## API overview

All endpoints are under `/api` and, except the auth endpoints, need `Authorization: Bearer <token>`. Errors are returned as `{"detail": "..."}` with a suitable status code (400/401/403/404/409/422). Full schema: `/docs`.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/otp` | Start verification (mocked; returns `is_registered` and a hint) |
| POST | `/auth/verify` | Verify `123456`, register if new → `{token, user, is_new_user}` |
| POST | `/auth/logout` | Revoke the current session |
| GET / PATCH | `/users/me` | Current profile / update name, about, username, avatar colour |
| PUT | `/users/me/avatar` | Set or clear the profile photo (`attachment_id` from an upload) |
| GET | `/users/lookup?q=` | Find a user by exact phone number or username |
| GET / POST | `/contacts` | List contacts / add a contact `{user_id}` |
| DELETE | `/contacts/{user_id}` | Remove a contact |
| GET | `/conversations` | My conversations, most recent first, with unread count and last message |
| POST | `/conversations/direct` | Get or create the 1:1 chat with `{user_id}` (idempotent) |
| POST | `/conversations/groups` | Create a group `{title, member_ids}` (creator becomes admin) |
| GET / PATCH | `/conversations/{id}` | Details / rename, description, disappearing timer |
| POST | `/conversations/{id}/members` | **Admin:** add members |
| PATCH | `/conversations/{id}/members/{user_id}` | **Admin:** promote or demote `{role}` |
| DELETE | `/conversations/{id}/members/{user_id}` | **Admin:** remove a member, or leave (yourself) |
| GET | `/conversations/{id}/messages?before_id=&limit=` | Cursor-paginated history (oldest → newest) |
| POST | `/conversations/{id}/messages` | Send `{body, client_id, reply_to_id?, attachment_id?}` |
| POST | `/conversations/{id}/read` | Mark everything read (triggers read receipts) |
| PUT / DELETE | `/messages/{id}/reaction` | Set or remove my reaction |
| POST | `/attachments` | Upload a file (multipart, ≤ 10 MB) → `{id, url, …}` |
| WS | `/ws?token=` | Real-time channel (see the protocol above) |
| GET | `/health` | Health check |

---

## Project structure

```
backend/
  app/
    main.py            app factory, CORS, error mapping, lifespan (tables, seed, sweeper)
    config.py          env-driven settings
    database.py        engine, session, SQLite pragmas
    models.py          ORM schema
    schemas.py         Pydantic request/response models
    deps.py            auth dependency, event dispatch helper
    realtime.py        WebSocket connection manager
    tasks.py           disappearing-message sweeper
    seed.py            demo data
    routers/           auth · users · contacts · conversations · messages · ws
    services/          users · conversations · messages · membership · attachments · presenters · errors
  tests/               pytest suite (HTTP + WebSocket)
frontend/
  src/
    app/               layout (fonts, theme bootstrap), page
    components/        common · layout · sidebar · chat · details · modals · settings · onboarding · profile
    hooks/             useRealtime · useKeyboardShortcuts · useTheme · useNow · selectors
    store/             session · chat · ui (Zustand)
    lib/               api · socket · types · format · conversation · avatar
```

---

## Deployment

**Backend → Render** (or Railway/Fly). `render.yaml` at the repo root is a ready-made Blueprint (root dir `backend`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`). A `backend/Dockerfile` is also included for container hosts; mount a volume at `/data` to keep the database between deploys.

| Env var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///backend/signal.db` | SQLite path |
| `UPLOAD_DIR` | `backend/uploads` | Attachment storage |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `MOCK_OTP` | `123456` | Accepted verification code |
| `SEED_ON_STARTUP` | `true` | Seed demo data when the DB is empty |

**Frontend → Vercel.** Import the repo, set **Root Directory** to `frontend`, and add `NEXT_PUBLIC_API_URL=https://<your-backend-host>` (the WebSocket URL is derived from it, `https` → `wss`).

---

## Assumptions & trade-offs

- **Mocked verification and encryption**, as the brief allows: the OTP is fixed, and there is no Signal Protocol. Messages are stored in plain text, and the safety number is a deterministic hash for display only.
- **Single backend process.** Live connections are kept in memory, so the API runs with one worker. Scaling out would need a pub/sub backplane (for example Redis) between instances.
- **Ephemeral hosting storage.** On free tiers without a persistent disk, the SQLite file and uploads reset on redeploy, and the app re-seeds the demo data automatically.
- **Sessions don't expire** (demo simplicity). Logout revokes the token server-side.
- **Contacts are directional** (like a phone address book). Anyone can message any registered user they find by exact phone number or username, as in Signal. There is no fuzzy directory search.
- **Group permissions**: any member can rename the group or change the timer (Signal's default "All members" setting). Only admins can add, remove, promote or demote members.
- **Read receipts** are sent when a chat is open in a visible tab. In groups a message shows "read" once *every* recipient has read it.
- **Disappearing timers** start when a message is sent (Signal starts them when it's read). This keeps expiry server-authoritative and simple.
- **Removed members** lose access to the group's history (the membership row is deleted), rather than keeping a read-only copy.
- The UI recreates Signal's layout, colours and interactions. Icons are original SVGs drawn in a similar style, and no Signal assets or code were used.
