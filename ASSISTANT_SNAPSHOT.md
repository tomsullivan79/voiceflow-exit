# Assistant Snapshot — Canonical Index

> **Purpose**: This is the single source of truth for Chat to anchor context.
> Read this first before analyzing code or proposing changes.

## Repo & Build
- **Repo**: https://github.com/tomsullivan79/voiceflow-exit
- **Default branch**: main
- **Latest commit**: 05b1011 — 18C-Fix5: guard slug before indexing; alias narrow; tighten types
- **Updated (America/Chicago)**: 2025-09-29 13:52 CT
- **Prod URL**: https://app.wildtriage.org/  (if applicable)

> When you (Chat) start a session, verify the latest commit SHA matches what Tom pasted in the Session Starter or what `/api/version` reports in prod (if available). If it doesn’t match, stop and ask.

---

## App Tree (Top 2–3 levels, high-value areas)
*(Keep this concise; we will automate refresh in A1-2)*
```text
app/
  admin/
    env/
    species/
  api/
    admin/
    auth/
    cases/
    chat/
    debug/
    health/
    ingest/
    memories/
    sms/
    version/
    web-chat/
  auth/
    callback/
    auth-client.tsx
    page.tsx
  cases/
    [id]/
    AutoRefresher.tsx
    page.tsx
    RealtimeCasesListListener.tsx
    RefreshListClient.tsx
  chat/
    page.tsx
    PolicyBanner.tsx
  ingest/
    page.tsx
  memories/
    client-list.tsx
    page.tsx
  privacy/
    page.tsx
  sms/
    [sid]/
    page.tsx
  terms/
    page.tsx
  version/
    page.tsx
  whoami/
    page.tsx
  favicon.ico
  globals.css
  layout.tsx
  page.backup.tsx
  page.module.css
  page.tsx
  styles.css
components/
  BrandHeader.tsx
  VersionChip.tsx
lib/
  chunk.ts
  policy.ts
  supabaseAdmin.ts
  supabaseBrowser.ts
  supabaseServer.ts
  supabaseServerAuth.ts
  twilio.ts
public/
  file.svg
  globe.svg
  Green_Sage.png
  next.svg
  vercel.svg
  window.svg
db/
  CHANGES/
    .gitkeep
    2025-09-28__example.sql
    README.md
  SCHEMA.md
  SCHEMA.sql
docs/
  PROJECT_STATE.md
  WORKING_AGREEMENTS.md
assistant/
  data-model.md
  experiments.md
  policy.md
  README.md
  routes.md
  snapshot.json
  species-meta-notes.md
.env.example
.gitignore
ASSISTANT_SNAPSHOT.md
README.md
White_Sage.png
data/
  raw/
    species-meta-lookup.yaml
    species-meta.yaml
eslint.config.mjs
next-env.d.ts
next.config.js
next.config.ts
package-lock.json
package.json
scripts/
  convert_species_yaml.cjs
  convert_species_yaml.ts
  data-model-from-sql.mjs
  loose_merge_from_txt.cjs
  merge_species.ts
  schema-md-from-sql.mjs
  update-assistant-snapshot.mjs
  vercel-ignore.sh
tsconfig.json
types/
  species.ts
  variableBus.ts
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
4. Verify /api/version or /version in prod shows the same short SHA as **Latest commit** above.


---

## Manual Refresh (until A1-2)
Update the **Latest commit** and **Updated** lines above after each push to `main`.
In **A1-2**, we’ll add a GitHub Action to refresh these automatically.
