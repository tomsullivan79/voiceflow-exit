# Curated Instructions — How to author

Files live under `content/instructions/<mode>/...`

- **Mode folders**: `triage/`, `referral/`, `patient_status/`
- **Triage naming**: `<decision>.<species_slug>.md` (most specific) → `<decision>.default.md` (fallback)
- **Referral naming**: `<species_slug>.md` or `default.md`
- **Patient status**: `default.md`

## Formatting
- Optional H1 at the top becomes the **steps block title**.
- Bullets must start with `- `, `* `, or `1. ` and will render as separate step lines.
- Non-bulleted paragraphs are included as single lines.

## Variables (coming soon)
- In a later pass we’ll support placeholders like `{{species}}`, `{{contact.phone}}`, etc.
