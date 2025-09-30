export function normalizeResult(
  result: { blocks: any[]; updatedBus?: any },
  baseBus: any
) {
  if (!result) return result;
  const updated = result.updatedBus ?? {};
  const bus = baseBus ?? {};

  // Ensure triage and common flags exist
  updated.triage = updated.triage ?? {};

  // Decide when caution is required:
  // - dispatch decision OR
  // - dangerous species (from either base bus or updated bus)
  const decision: string | undefined = updated?.triage?.decision;
  const speciesDangerous =
    !!(updated?.species_flags?.dangerous ?? bus?.species_flags?.dangerous);

  if (updated.triage.caution_required === undefined || updated.triage.caution_required === null) {
    if (decision === 'dispatch' || speciesDangerous) {
      updated.triage.caution_required = true;
    }
  }

  // Normalize referral block: title + directions_url
  if (Array.isArray(result.blocks)) {
    for (const b of result.blocks) {
      if (b?.type === 'referral') {
        // Title default
        if (!b.title) b.title = 'Referral';

        // Move nested directions_url -> top-level
        const nested = b?.target?.directions_url;
        if (nested && !b?.directions_url) {
          b.directions_url = nested;
        }
        if (b?.target && 'directions_url' in b.target) {
          try { delete b.target.directions_url; } catch {}
        }
      }
    }
  }

  result.updatedBus = updated;
  return result;
}
