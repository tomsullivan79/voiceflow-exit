# Routes — Contracts (v1)

## POST /api/web-chat/message
**Purpose:** Create/reuse a web conversation from cookie; insert user message.
**Inputs (JSON):** `{ message: string }`
**Behavior:**
- Reads/sets `wt_web_cookie` → maps to `conversations` via `web_conversation_cookies`.
- Ensures `conversations.user_id = WEB_CHAT_OWNER_USER_ID`, `source = "web"`, `title = "Web Chat"` if first msg.
- Inserts **user** row into `conversation_messages`.
**Returns:** `{ conversation_id: uuid }` (plus any policy/species hints if available).
**Notes:** Rate-limit headers expected (planned).

## POST /api/web-chat/assistant
**Purpose:** Persist assistant reply for a conversation.
**Inputs (JSON):** `{ conversation_id: uuid, text: string }`
**Behavior:** Inserts **assistant** row into `conversation_messages` (idempotent guards expected at caller).
**Returns:** `{ ok: true }`

## POST /api/chat
**Purpose:** Obtain assistant text (browser-side call for now).
**Returns:** `{ text: string }` (then `/api/web-chat/assistant` persists it).

## POST /api/sms/twilio
**Purpose:** Inbound SMS webhook.
**Behavior:** Logs inbound “received” events (after signature verification). Planned: link to cases by `From`.

## POST /api/sms/status
**Purpose:** Twilio delivery callbacks (accepted/queued/sent/delivered/failed).
**Behavior:** Always 200; stores event rows in `public.sms_events`.

## GET /api/pack/integrity
**Purpose:** Verify pack manifest + chunks integrity (Book2AI).
**Returns:** `{ manifest, files[], sealed }`

## GET /api/version
**Purpose:** Report build commit + built_at (planned).
**Returns:** `{ commit, built_at }` (CT)
