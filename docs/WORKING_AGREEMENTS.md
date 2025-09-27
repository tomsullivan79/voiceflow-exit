# Working Agreements (Canonical)

- **One tiny step per turn** with a label (e.g., 16A) and a single **Done keyword** to paste back (e.g., 16A-Done).
- **Full drop-in files only** (no partial diffs). If a file changes, output the entire replacement.
- **Git commands come first**, then **Test & Verify** checklist, then **Next-step options**.
- **DB changes** run in **Supabase SQL Editor**, not via migrations (unless explicitly stated otherwise).
- **Prod-first validation**: push to main → Vercel auto-deploy → test on prod.
- **Timezone**: America/Chicago for timestamps and displays.
- **Bracket escaping** in git paths (e.g., `git add app/cases/\[id\]/page.tsx`).
- **No large refactors** without presenting options & tradeoffs first.
- **Contract Check** keyword: if the assistant slips into vague mode, reply “Contract Check” to restart in the agreed format.
