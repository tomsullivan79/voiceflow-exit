// lib/data/speciesGroups.ts
export type SpeciesGroup = "raptor" | "corvid";

const RAPTOR: string[] = [
  // common raptors (lowercase, hyphenated slugs)
  "osprey",
  "bald-eagle",
  "golden-eagle",
  "red-tailed-hawk",
  "coopers-hawk",
  "sharp-shinned-hawk",
  "northern-harrier",
  "kestrel",
  "american-kestrel",
  "peregrine-falcon",
  "merlin",
  "barn-owl",
  "great-horned-owl",
  "barred-owl",
  "snowy-owl",
  "short-eared-owl",
  "long-eared-owl",
  "screech-owl",
];

const CORVID: string[] = [
  "american-crow",
  "northwestern-crow",
  "common-raven",
  "chihuahuan-raven",
  "blue-jay",
  "stellers-jay",
  "gray-jay",
  "black-billed-magpie",
];

const LOOKUP: Record<string, SpeciesGroup> = Object.fromEntries([
  ...RAPTOR.map(s => [s, "raptor" as SpeciesGroup]),
  ...CORVID.map(s => [s, "corvid" as SpeciesGroup]),
]);

export function speciesToGroup(slug?: string | null): SpeciesGroup | null {
  if (!slug) return null;
  const key = slug.trim().toLowerCase();
  return LOOKUP[key] ?? null;
}
