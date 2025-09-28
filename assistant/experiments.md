# Experiments & Feature Flags

## Current flags
- `DISABLE_OUTBOUND_SMS=true` — keep until A2P is finalized.

## Perf / UX toggles (planned)
- `/cases/[id]` realtime subscribe (enable when tiny client is stable)
- Rate limit on `/api/web-chat/message` (tune headers & UI feedback)
- Version chip footer (commit + built_at via `/api/version`)

## Test ideas
- Synthetic load on `/api/sms/status` ingestion (idempotency)
- Drop network on `/chat` mid-stream → confirm resume & persistence
