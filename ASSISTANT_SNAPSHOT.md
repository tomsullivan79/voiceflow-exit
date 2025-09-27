# Assistant Snapshot — Canonical Index

> **Purpose**: This is the single source of truth for Chat to anchor context.
> Read this first before analyzing code or proposing changes.

## Repo & Build
- **Repo**: https://github.com/tomsullivan79/voiceflow-exit
- **Default branch**: main
- **Latest commit**: <PASTE SHORT SHA> — <PASTE COMMIT TITLE>
- **Updated (America/Chicago)**: <YYYY-MM-DD HH:mm CT>
- **Prod URL**: https://app.wildtriage.org/  (if applicable)

> When you (Chat) start a session, verify the latest commit SHA matches what Tom pasted in the Session Starter or what `/api/version` reports in prod (if available). If it doesn’t match, stop and ask.

---

## App Tree (Top 2–3 levels, high-value areas)
*(Keep this concise; we will automate refresh in A1-2)*
```text
app/
  api/
  cases/
  sms/
  chat/
components/
lib/
public/
db/              # schema snapshots live here when present
docs/            # working agreements & project state
```

---

## Hotspots (Direct raw links to key files)
> Update these as the code evolves. Use raw links so Chat can read immediately.

- **Pages / Routes**
  - `app/page.tsx` (Home):  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/app/page.tsx
  - `app/chat/page.tsx` (Web Chat):  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/app/chat/page.tsx
  - `app/cases/[id]/page.tsx` (Case detail):  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/app/cases/%5Bid%5D/page.tsx
  - `app/sms/page.tsx` (SMS list):  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/app/sms/page.tsx
  - `app/api/sms/status/route.ts` (Twilio delivery callbacks):  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/app/api/sms/status/route.ts
  - `app/api/sms/twilio/route.ts` (Inbound SMS webhook):  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/app/api/sms/twilio/route.ts

- **Server / Lib**
  - `lib/supabaseServer.ts` (server client, if present):  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/lib/supabaseServer.ts
  - `lib/types.ts`:  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/lib/types.ts

- **UI / Components**
  - `components/*` (shared UI):  
    https://github.com/tomsullivan79/voiceflow-exit/tree/main/components

- **Config**
  - `next.config.ts`:  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/next.config.ts
  - `.env.example` (if exists):  
    https://raw.githubusercontent.com/tomsullivan79/voiceflow-exit/main/.env.example

---

## Database Schema Anchors (Supabase)
> Source of truth lives in `db/` (committed). If you change schema in Supabase SQL editor,
> paste the exact SQL into `db/CHANGES/<YYYY-MM-DD>_change.sql` and re-export `db/SCHEMA.sql`.

- `db/SCHEMA.sql` — authoritative DDL snapshot (exported from Supabase)
- `db/SCHEMA.md` — human-readable summary (tables, columns, indexes, FKs, enums)
- `db/CHANGES/` — date-stamped snippets you actually ran

*(These files will be added in step **C1**; for now this section is a placeholder.)*

---

## Ritual (How Chat should behave)
1. Confirm latest commit SHA and time against this file and (if relevant) `/api/version`.
2. Read **docs/WORKING_AGREEMENTS.md** and **docs/PROJECT_STATE.md**.
3. Follow the contract: one tiny step → full drop-ins → git cmds → Test & Verify → next-step options.

---

## Manual Refresh (until A1-2)
Update the **Latest commit** and **Updated** lines above after each push to `main`.
In **A1-2**, we’ll add a GitHub Action to refresh these automatically.
