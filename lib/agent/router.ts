// lib/agent/router.ts
import { VariableBus } from "@/types/variableBus";

export type Urgency = NonNullable<VariableBus["triage"]["urgency"]>;
export type Decision = NonNullable<VariableBus["triage"]["decision"]>;

export type RouteOutput = {
  decision: Decision;
  urgency: Urgency;
  reasons: string[];              // human-readable heuristics
  afterHoursNote?: string;        // if after-hours altered decision/flow
};

/** Compute medical/public-safety urgency from the Variable Bus. */
export function assessUrgency(bus: VariableBus): { urgency: Urgency; reasons: string[] } {
  const reasons: string[] = [];
  let urgency: Urgency = "low";

  const rabies = !!bus.species_flags.rabies_vector;
  const dangerous = !!bus.species_flags.dangerous;
  const contained = !!bus.animal.contained;

  // Exposure → critical
  if (bus.exposure?.human_bite_possible && rabies) {
    urgency = "critical";
    reasons.push("Possible human bite exposure to a rabies-vector species.");
  }
  if (bus.exposure?.bat_sleeping_area && (rabies || (bus.animal.species_slug ?? "").includes("bat"))) {
    urgency = "critical";
    reasons.push("Bat found near sleeping person — potential exposure.");
  }

  // Aggression + dangerous + uncontained → high (or critical if already)
  if (bus.animal.aggressive_behavior && dangerous && !contained) {
    urgency = urgency === "critical" ? "critical" : "high";
    reasons.push("Aggressive behavior with dangerous species and not contained.");
  }

  // Injured/sick and not contained → medium+ if not already higher
  if ((bus.animal.observed_condition === "injured" || bus.animal.observed_condition === "sick") && !contained) {
    if (urgency === "low") urgency = "medium";
    reasons.push("Animal appears injured/sick and is not contained.");
  }

  // Neonate orphaned → medium baseline
  if (
    (bus.animal.situation === "orphaned" || bus.animal.situation === "abandoned") &&
    (bus.animal.age_class === "neonate" || bus.animal.age_class === "juvenile")
  ) {
    if (urgency === "low") urgency = "medium";
    reasons.push("Young animal potentially orphaned/abandoned.");
  }

  return { urgency, reasons };
}

/** Per-species / per-policy decision baseline (pre after-hours). */
export function baselineDecision(bus: VariableBus, urgency: Urgency): { decision: Decision; reasons: string[] } {
  const reasons: string[] = [];

  // Hard overrides from species flags
  if (bus.species_flags.referral_required) {
    reasons.push("Species requires referral per org policy/partners.");
    return { decision: "referral", reasons };
  }

  if (bus.species_flags.intervention_needed) {
    reasons.push("Species flagged as 'intervention needed'.");
    return { decision: "bring_in", reasons };
  }

  // Heuristics by situation/condition
  if (bus.animal.observed_condition === "injured" || bus.animal.observed_condition === "sick") {
    reasons.push("Observed condition indicates injury/illness.");
    return { decision: "bring_in", reasons };
  }

  if (bus.animal.situation === "orphaned" || bus.animal.situation === "abandoned") {
    if (bus.animal.age_class === "neonate" || bus.animal.age_class === "juvenile") {
      reasons.push("Likely orphaned juvenile/neonate — containment and self care.");
      return { decision: "self_help", reasons };
    } else {
      reasons.push("Possible misinterpretation; monitor adult/unknown age first.");
      return { decision: "monitor", reasons };
    }
  }

  // Public safety escalation
  const dangerous = !!bus.species_flags.dangerous;
  const contained = !!bus.animal.contained;
  if (urgency === "critical" && dangerous && !contained) {
    reasons.push("Critical + dangerous + uncontained → dispatch.");
    return { decision: "dispatch", reasons };
  }

  // Default posture
  reasons.push("Default to bring_in if uncertain with non-trivial concern.");
  return { decision: "bring_in", reasons };
}

/** After-hours policy adjustments. */
export function applyAfterHours(
  bus: VariableBus,
  decision: Decision,
  urgency: Urgency
): { decision: Decision; note?: string; reasons: string[] } {
  const reasons: string[] = [];
  let final: Decision = decision;
  let note: string | undefined;

  if (!bus.org.after_hours) return { decision: final, note, reasons };

  // Referral partners may still accept; do not block referral.
  if (decision === "referral") {
    reasons.push("After-hours OK: referral handled by partner.");
    return { decision: final, note, reasons };
  }

  const rule = bus.org.after_hours_rule ?? "deflect";
  switch (rule) {
    case "deflect":
    case "info_only": {
      // Deflect to safe overnight care unless critical
      if (urgency === "critical") {
        reasons.push(`After-hours '${rule}': critical case — escalate to dispatch.`);
        final = "dispatch";
        note = "After-hours policy escalated critical case.";
      } else {
        reasons.push(`After-hours '${rule}': provide safe overnight care.`);
        if (decision === "bring_in") {
          final = "self_help";
          note = "After-hours: defer intake; provide overnight guidance.";
        }
      }
      break;
    }
    case "intake_limited": {
      if (urgency === "high" || urgency === "critical") {
        reasons.push("After-hours 'intake_limited': allow bring_in for high/critical.");
        final = decision === "dispatch" ? "dispatch" : "bring_in";
      } else {
        reasons.push("After-hours 'intake_limited': defer non-urgent to overnight care.");
        if (decision === "bring_in") final = "self_help";
        note = "After-hours limited intake; provide overnight guidance.";
      }
      break;
    }
    case "escalate": {
      reasons.push("After-hours 'escalate': honor decision; escalate if critical.");
      if (urgency === "critical" && decision !== "dispatch") {
        final = "dispatch";
        note = "After-hours escalate: critical case routed to dispatch.";
      }
      break;
    }
    default: {
      reasons.push("Unknown after-hours rule; defaulting to 'deflect'.");
      if (urgency === "critical") {
        final = "dispatch";
        note = "After-hours default: critical case escalated.";
      } else if (decision === "bring_in") {
        final = "self_help";
        note = "After-hours default: overnight guidance.";
      }
    }
  }

  return { decision: final, note, reasons };
}

/** Main router: returns decision/urgency/reasons and an after-hours note. */
export function routeDecision(bus: VariableBus): RouteOutput {
  // Respect explicit decision if already chosen (except we may after-hours adjust).
  const explicit = bus.triage?.decision && bus.triage.decision !== "unknown" ? (bus.triage.decision as Decision) : undefined;

  const u = assessUrgency(bus);
  const base = explicit
    ? { decision: explicit, reasons: ["Explicit decision provided by upstream logic."] }
    : baselineDecision(bus, u.urgency);

  const ah = applyAfterHours(bus, base.decision, u.urgency);
  const finalDecision = ah.decision;

  return {
    decision: finalDecision,
    urgency: u.urgency,
    reasons: [...u.reasons, ...base.reasons, ...ah.reasons],
    afterHoursNote: ah.note,
  };
}
