# DB Change Snippets

Source of truth for schema is `db/SCHEMA.sql` (exported via Supabase CLI).
This folder tracks the **exact SQL you executed** in Supabase for each change.

## Naming
`YYYY-MM-DD_short-description.sql` (one change per file; add multiple files if you run separate edits the same day).

## Workflow
1) Run SQL in Supabase SQL Editor (apply change).
2) Paste the same SQL into a new file here with the naming above.
3) Re-export DDL to `db/SCHEMA.sql` via `supabase db dump --linked --schema public --schema-only --file db/SCHEMA.sql`.
4) Commit & push. CI will refresh `db/SCHEMA.md` and `assistant/data-model.md`.

## Notes
- Don’t try to “replay” these as migrations; they are an audit trail.
- If you revert something, add a new file with the revert SQL; don’t edit history files.