// app/dev/chat/page.tsx
"use client";
import React from "react";

type ApiResult = {
  ok: boolean;
  usedLLM?: boolean;
  result?: any;
  llm_preface?: string | null;
  curatedSource?: string | null;
  placeholderApplied?: boolean;
  agentInstructionsSource?: string | null;
  agentPlaceholderApplied?: boolean;
  x_request_id?: string | null;
};

export default function DevChat() {
  const [tone, setTone] = React.useState<"" | "supportive">("");
  const [playbook, setPlaybook] = React.useState<"" | "onsite_help" | "after_hours_support">("");
  const [mode, setMode] = React.useState<"triage" | "referral" | "patient_status">("triage");
  const [species, setSpecies] = React.useState("american-crow"); // quick default for corvid tests
  const [decision, setDecision] = React.useState<"" | "referral" | "dispatch">("referral");
  const [resp, setResp] = React.useState<ApiResult | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function run(forceDeterministic: boolean) {
    setLoading(true);
    try {
      const body = {
        bus: {
          mode,
          overlays: {
            tone_overlay: tone || undefined,
            playbook: playbook || undefined,
          },
          triage: decision ? { decision } : {},
          caller: { zip: "55414", county: "Hennepin County" },
          animal: { species_slug: species, species_text: species.replace(/-/g, " ") },
          org: { site_code: "WRCMN", timezone: "America/Chicago", after_hours: playbook === "after_hours_support" },
          system: { channel: "web", system_time: new Date().toISOString() },
        },
      };
      const qs = new URLSearchParams();
      if (forceDeterministic) qs.set("force", "false");
      qs.set("debug", "1");
      const r = await fetch(`/api/agent/llm?${qs.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as ApiResult;
      setResp(j);
    } catch (e) {
      setResp({ ok: false } as any);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setTone("");
    setPlaybook("");
    setMode("triage");
    setSpecies("american-crow");
    setDecision("referral");
    setResp(null);
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">/dev/chat — Agent + Curated Preview</h1>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Mode</label>
          <select className="w-full border rounded p-2"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as any)}>
            <option value="triage">triage</option>
            <option value="referral">referral</option>
            <option value="patient_status">patient_status</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Tone overlay</label>
          <select className="w-full border rounded p-2"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as any)}>
            <option value="">(none)</option>
            <option value="supportive">supportive</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Playbook</label>
          <select className="w-full border rounded p-2"
                  value={playbook}
                  onChange={(e) => setPlaybook(e.target.value as any)}>
            <option value="">(none)</option>
            <option value="onsite_help">onsite_help</option>
            <option value="after_hours_support">after_hours_support</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Species (slug)</label>
          <input className="w-full border rounded p-2"
                 value={species}
                 onChange={(e) => setSpecies(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Decision (triage)</label>
          <select className="w-full border rounded p-2"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as any)}>
            <option value="">(none)</option>
            <option value="referral">referral</option>
            <option value="dispatch">dispatch</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
                disabled={loading}
                onClick={() => run(true)}>
          Run (deterministic)
        </button>
        <button className="px-3 py-2 rounded border disabled:opacity-50"
                disabled={loading}
                onClick={() => run(false)}>
          Run (LLM path)
        </button>
        <button className="px-3 py-2 rounded border"
                onClick={reset}>
          Reset to preset
        </button>
      </div>

      {/* Badges */}
      {resp && (
        <div className="text-sm text-gray-700">
          <div>usedLLM: <b>{String(resp.usedLLM)}</b></div>
          {resp.curatedSource && <div>curatedSource: <code>{resp.curatedSource}</code></div>}
          {resp.agentInstructionsSource && <div>agentInstructionsSource: <code>{resp.agentInstructionsSource}</code></div>}
        </div>
      )}

      {/* Preview panes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <h2 className="font-semibold mb-2">Agent Preface (llm_preface)</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {resp?.llm_preface || "—"}
          </pre>
        </div>
        <div className="border rounded p-3">
          <h2 className="font-semibold mb-2">Blocks → Steps (curated)</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {(() => {
              const steps = resp?.result?.blocks?.find((b: any) => b?.type === "steps");
              if (!steps) return "—";
              const title = steps.title ? `${steps.title}\n\n` : "";
              const lines = (steps.lines || []).map((l: string) => `• ${l}`).join("\n");
              return title + lines;
            })()}
          </pre>
        </div>
      </div>
    </div>
  );
}
