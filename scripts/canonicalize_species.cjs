// node scripts/canonicalize_species.cjs
// Folds synonym slugs into canonical slugs inside data/species-merged.json

const fs = require("fs");
const path = require("path");
const MERGED = path.join(process.cwd(), "data/species-merged.json");

const CANON = {
  // obvious spelling fix
  morning_dove: "mourning_dove",
  // common shorthands — adjust these if you prefer different targets
  bunny: "eastern_cottontail",
  rabbit: "eastern_cottontail",
  squirrel: "eastern_gray_squirrel",
  chipmunk: "eastern_chipmunk",
};

function toSlug(s){ return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
function mergeTriage(src, dst){
  const triageKeys = [
    "intervention_needed","referral_required_level","dangerous_level","rabies_vector_level",
    "needs_species_escalation_level","bat_exposure_level","potential_aggression","age_assessment_needed",
    "referral_required","dangerous","rabies_vector"
  ];
  for (const k of triageKeys) if (src[k] !== undefined) dst[k] = src[k];
}
function main(){
  const merged = JSON.parse(fs.readFileSync(MERGED, "utf8"));
  const bySlug = new Map(merged.species.map(s => [s.slug, s]));
  let mergedCount = 0;

  for (const [alias, target] of Object.entries(CANON)) {
    const a = bySlug.get(alias);
    const t = bySlug.get(target);
    if (!a) continue;               // alias not present; nothing to do
    if (!t) {
      // If target missing, promote alias to canonical target name instead of deleting
      a.slug = target;              // rename slug
      bySlug.delete(alias);
      bySlug.set(target, a);
      mergedCount++;
      continue;
    }
    // Merge alias into target
    // 1) triage from alias (lookup) should win
    mergeTriage(a, t);
    // 2) unify tags/aliases
    const aliases = new Set([...(t.aliases||[]), alias, ...(a.aliases||[])].map(toSlug));
    t.aliases = Array.from(aliases).sort();
    // 3) prefer non-empty rich fields if target missing them
    for (const k of ["description","care_advice","keywords","scientific_name","photo_url","category"]) {
      if ((t[k] == null || t[k] === "" || (k==="keywords" && !Object.keys(t[k]||{}).length)) && a[k] != null) {
        t[k] = a[k];
      }
    }
    bySlug.delete(alias);
    mergedCount++;
  }

  merged.species = Array.from(bySlug.values()).sort((a,b)=>a.slug.localeCompare(b.slug));
  fs.writeFileSync(MERGED, JSON.stringify(merged, null, 2), "utf8");
  console.log(`Canonicalized ${mergedCount} entries. New species count: ${merged.species.length}`);
}

main();
