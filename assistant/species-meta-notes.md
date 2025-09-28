# Species Meta — Working Notes

**Goal:** structured metadata per species to drive triage logic and safe routing.

## Proposed fields
- `scientific_name`, `common_name`, `slug`
- `dangerous` (bool)
- `rabies_vector` (bool)
- `referral_required` (enum: none | vet | WRC)
- `intervention_needed` (enum: none | observe | capture | transport)
- `active_hours` (enum)
- `seasonal_flags` (jsonb) e.g., nestling season windows

## Open questions
- Per-org overrides (WRC vs others)?
- Confidence thresholds from MMS image classifier?
- Default advice script per category?

## Next
- Create `public.species_meta` with above columns (see C1 step).
- Seed a minimal list (MN common species) to unlock rules.
