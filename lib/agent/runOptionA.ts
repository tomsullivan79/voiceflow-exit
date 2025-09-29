// lib/agent/runOptionA.ts
import { VariableBus, Mode } from "@/types/variableBus";
import { referralSearch } from "@/lib/tools/referralSearch";
import { statusLookup } from "@/lib/tools/statusLookup";
import { instructionsFetch } from "@/lib/tools/instructionsFetch";
import { routeDecision } from "@/lib/agent/router";

export type AgentBlockType = "summary" | "steps" | "referral" | "status" | "warning";
export type AgentBlock = {
  type: AgentBlockType;
  title?: string;
  text?: string;
  lines?: string[];
};

export type AgentResult = {
  mode: Mode;
  blocks: AgentBlock[];
  updatedBus: Partial<VariableBus>; // minimal patch
  debug?: Record<string, unknown>;
};

export async function runOptionA(bus: VariableBus): Promise<AgentResult> {
  const blocks: AgentBlock[] = [];
  const patch: Partial<VariableBus> = {};

  switch (bus.mode) {
    case "triage": {
      const species = bus.animal.species_slug ?? bus.animal.species_text ?? "unknown species";

      // Router decides decision/urgency with heuristics (incl. after-hours & public-health)
      const routed = routeDecision(bus);
      patch.triage = {
        ...(bus.triage ?? {}),
        decision: routed.decision,
        urgency: routed.urgency,
        caution_required:
          !!bus.species_flags.dangerous ||
          !!bus.exposure?.human_bite_possible ||
          !!bus.exposure?.bat_sleeping_area,
      };

      // After-hours note → warning block (if present)
      if (routed.afterHoursNote) {
        blocks.push({ type: "warning", title: "After-hours policy", text: routed.afterHoursNote });
      }

      // Fetch instructions by final decision (dispatch => public-health playbook)
      const instr = await instructionsFetch({
        species_slug: bus.animal.species_slug,
        decision: routed.decision,
      });

      const stepsTitle =
        routed.decision === "dispatch" ? "Public Health — Do this now" : "Do this next";

      blocks.push(
        {
          type: "summary",
          title: "Triage Summary",
          text: `Decision: ${routed.decision} for ${species}. Urgency: ${routed.urgency}.`,
        },
        { type: "steps", title: stepsTitle, lines: instr.steps }
      );

      // Referral if required/selected
      if (routed.decision === "referral" || bus.species_flags.referral_required) {
        const ref = await referralSearch({ species_slug: bus.animal.species_slug ?? "" });
        patch.referral = {
          needed: ref.needed,
          validated: ref.needed,
          target: ref.target,
          directions_url: ref.target?.directions_url ?? null,
        };
        if (ref.needed && ref.target) {
          blocks.push({
            type: "referral",
            title: "Referral",
            lines: [
              `${ref.target.name}`,
              ref.target.phone ? `Phone: ${ref.target.phone}` : undefined,
              ref.target.url ? `Website: ${ref.target.url}` : undefined,
              ref.target.coverage ? `Notes: ${ref.target.coverage}` : undefined,
              ref.target.directions_url ? `Directions: ${ref.target.directions_url}` : undefined,
            ].filter(Boolean) as string[],
          });
        }
      }

      return {
        mode: bus.mode,
        blocks,
        updatedBus: patch,
        debug: {
          router: routed,
          instrSource: instr.source,
        },
      };
    }

    case "patient_status": {
      const inp = {
        case_id: bus.patient_status?.case_id,
        phone: bus.caller?.phone,
        species_text: bus.patient_status?.lookup_identifiers?.species_text,
        admit_date: bus.patient_status?.lookup_identifiers?.admit_date,
      };
      const res = await statusLookup(inp);

      patch.patient_status = {
        ...(bus.patient_status ?? {}),
        case_id: res.patient.case_id,
        status: res.patient.status,
        status_description: res.patient.status_description,
        admit_date: res.patient.admit_date,
        release_date: res.patient.release_date ?? undefined,
        last_update_at: res.patient.last_update_at,
      };

      blocks.push({
        type: "status",
        title: "Patient Status",
        lines: [
          `Case: ${res.patient.case_id}`,
          `Status: ${res.patient.status}`,
          res.patient.status_description ? `Info: ${res.patient.status_description}` : undefined,
          res.patient.release_date ? `Release date: ${res.patient.release_date}` : undefined,
          `Admit date: ${res.patient.admit_date}`,
          `Last update: ${res.patient.last_update_at}`,
        ].filter(Boolean) as string[],
      });

      return {
        mode: bus.mode,
        blocks,
        updatedBus: patch,
        debug: { matched: res.matched, matchedBy: res.matchedBy },
      };
    }

    case "referral": {
      const ref = await referralSearch({ species_slug: bus.animal.species_slug ?? "" });
      patch.referral = {
        needed: ref.needed,
        validated: ref.needed,
        target: ref.target,
        directions_url: ref.target?.directions_url ?? null,
      };

      if (!ref.needed) {
        blocks.push({
          type: "summary",
          text: "No referral needed. Your organization can handle this species.",
        });
      } else if (ref.target) {
        blocks.push({
          type: "referral",
          title: "Referral",
          lines: [
            `${ref.target.name}`,
            ref.target.phone ? `Phone: ${ref.target.phone}` : undefined,
            ref.target.url ? `Website: ${ref.target.url}` : undefined,
            ref.target.coverage ? `Notes: ${ref.target.coverage}` : undefined,
            ref.target.directions_url ? `Directions: ${ref.target.directions_url}` : undefined,
          ].filter(Boolean) as string[],
        });
      }
      return { mode: bus.mode, blocks, updatedBus: patch };
    }
  }
}
