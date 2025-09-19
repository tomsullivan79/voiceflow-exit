"use client";

import { useState } from "react";

export default function AdminSpeciesPage() {
  const [jsonText, setJsonText] = useState<string>(`{
  "species": [
    {
      "slug": "snapping_turtle",
      "common_name": "Snapping Turtle",
      "category": "reptile",
      "dangerous_level": "always",
      "dangerous": true,
      "referral_required_level": "false",
      "rabies_vector_level": "false",
      "intervention_needed": "conditional",
      "potential_aggression": "high",
      "age_assessment_needed": false,
      "aliases": ["snapper","common_snapping_turtle"],
      "keywords": { "shape": ["large","heavy"], "behavior": ["snaps"], "environment": ["wetlands","ponds"] },
      "tags": ["dangerous_handling"]
    }
  ]
}`);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  async function onSeed() {
    setBusy(true);
    setResult("");
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch("/api/admin/seed-species", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Optionally set x-seed-secret if you configured SEED_SECRET
          // "x-seed-secret": "<your-secret>"
        },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Seed failed");
      setResult(`✅ Seeded: ${data.upserted_species} species, ${data.upserted_aliases} aliases`);
    } catch (e: any) {
      setResult(`❌ ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[80vh] w-full flex items-start justify-center">
      <div className="w-full max-w-3xl mt-8 rounded-2xl shadow p-5 md:p-8 bg-white/90 dark:bg-neutral-900/60">
        <h1 className="text-2xl font-semibold mb-2">Species Admin</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
          Paste merged JSON (lookup + full meta). Click <em>Seed</em> to upsert into <code>species_meta</code> and <code>species_aliases</code>.
        </p>

        <label className="block text-sm font-medium mb-1">JSON payload</label>
        <textarea
          className="w-full h-72 rounded-md border p-3 font-mono text-sm"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={onSeed}
            disabled={busy}
            className="px-4 py-2 rounded-xl shadow bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Seeding..." : "Seed"}
          </button>
          <span className="text-sm">{result}</span>
        </div>

        <hr className="my-6" />

        <details>
          <summary className="cursor-pointer font-medium">Payload schema</summary>
          <pre className="mt-3 text-xs overflow-auto">
{`{
  "species": [
    {
      "slug": "mourning_dove",
      "common_name": "Mourning Dove",
      "scientific_name": "Zenaida macroura",
      "category": "bird",
      "intervention_needed": "conditional",
      "referral_required_level": "false",
      "dangerous_level": "false",
      "rabies_vector_level": "false",
      "needs_species_escalation_level": "false",
      "bat_exposure_level": "false",
      "potential_aggression": "no",
      "age_assessment_needed": true,
      "description": "…",
      "keywords": { "shape": [], "color": [], "behavior": [], "environment": [] },
      "care_advice": "…",
      "tags": ["fledgling_common"],
      "aliases": ["morning_dove","dove"]
    }
  ]
}`}
          </pre>
        </details>
      </div>
    </main>
  );
}
