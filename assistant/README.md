# Assistant Bundle — How to Use

This folder is a compact map for Chat to stay in sync on this repo (WildTriage).  
**Read order:** `snapshot.json` → `routes.md` → `data-model.md` → `policy.md` → notes.

- `snapshot.json` = canonical config (env names, flags, routes) used for quick orientation and validation.
- `routes.md` = API contracts (inputs/outputs, side effects).
- `data-model.md` = tables, primary keys, important indexes, views.
- `policy.md` = policy categories and examples (supported, conditional, out_of_scope).
- `species-meta-notes.md` = design notes & open questions for species metadata.
- `experiments.md` = feature flags, performance toggles, and test ideas.

**Ritual for Chat at session start:**
1) Verify latest commit in `ASSISTANT_SNAPSHOT.md` (already auto-updated).
2) Skim `assistant/snapshot.json`; assert envs/flags exist.
3) Use `routes.md`/`data-model.md` when proposing code that touches APIs or DB.
4) Obey `docs/WORKING_AGREEMENTS.md` (one tiny step → full drop-ins → git cmds → Test & Verify → next options).
