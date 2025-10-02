import test from "node:test";
import assert from "node:assert/strict";

// Import the same functions via the module under test.
// If these are not exported, you can either export them or call getCuratedInstructions with a crafted bus.
import * as CI from "@/lib/tools/curatedInstructions";

// If internal helpers aren't exported, switch to using getCuratedInstructions with a fake in-memory file read.
// For simplicity here, we assume CI.applyPlaceholders and CI as needed are exported.
// If not, adapt by calling getCuratedInstructions with a temporary curated markdown string.

const sampleMd = `
<!-- author note: remove this before prod -->
### Referral — next steps
ZIP {{zip}} in {{county}} ({{county_name}}), species={{species}} ({{species_slug}}), decision={{decision}}, org={{org_site}} ({{org_timezone}})
`;

function busWith(overrides: any = {}) {
  return {
    mode: "triage",
    caller: { zip: "55414", county: "Hennepin County" },
    animal: { species_slug: "american-crow" },
    triage: { decision: "referral" },
    org: { site_code: "WRCMN", timezone: "America/Chicago" },
    ...overrides,
  };
}

// If CI.applyPlaceholders isn't exported, replace the two tests below with a call to CI.getCuratedInstructions(bus)
// after temporarily writing sampleMd to content/instructions/triage/referral.default.md in a fixture setup.
// Keeping it minimal here.

test("county_name strips suffixes (County/Parish/Borough/Municipio)", () => {
  const variants = [
    ["Hennepin County", "Hennepin"],
    ["Orleans Parish", "Orleans"],
    ["Juneau Borough", "Juneau"],
    ["Ponce Municipio", "Ponce"],
  ];
  for (const [raw, expected] of variants) {
    // @ts-ignore accessing internal for test; export countyNameOnly if needed
    const out = (CI as any).countyNameOnly(raw);
    assert.equal(out, expected);
  }
});

test("placeholders substitute and HTML comments are removed", () => {
  // @ts-ignore accessing internal for test; export applyPlaceholders if needed
  const { text, applied } = (CI as any).applyPlaceholders(sampleMd, busWith());
  assert.equal(applied, true);

  assert.ok(!text.includes("<!--"), "HTML comments should be stripped");

  // Substitutions present
  assert.match(text, /ZIP 55414/);
  assert.match(text, /Hennepin County/);
  assert.match(text, /Hennepin\)/); // county_name
  assert.match(text, /species=american crow/); // {{species}} replaces hyphens with spaces
  assert.match(text, /american-crow/); // {{species_slug}}
  assert.match(text, /decision=referral/);
  assert.match(text, /org=WRCMN/);
  assert.match(text, /\(America\/Chicago\)/);
});
