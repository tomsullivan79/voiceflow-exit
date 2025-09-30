import { publicHealthLookup } from '@/lib/tools/publicHealthLookup';

type Block = {
  type?: string;
  title?: string;
  text?: string;
  items?: Array<string | any>;
  lines?: Array<string | any>;
  [k: string]: any;
};

type BusLike = {
  caller?: { zip?: string; county?: string };
  triage?: { decision?: string };
};

/**
 * If triage.decision === 'dispatch', append public health contact lines to the first steps block.
 * Supports both shapes: steps.lines[] and steps.items[].
 * Idempotent-ish: won't re-add if the exact contact name is already present.
 */
export async function enrichDispatchSteps(
  blocks: Block[] = [],
  bus: BusLike | undefined
): Promise<Block[]> {
  const decision = bus?.triage?.decision;
  if (decision !== 'dispatch') return blocks;

  const zip = bus?.caller?.zip;
  const county = bus?.caller?.county;

  const { best, via } = await publicHealthLookup({ zip, county });
  if (!best) return blocks;

  // find/create steps block
  let steps = blocks.find((b) => b?.type === 'steps');
  if (!steps) {
    steps = { type: 'steps', title: 'Public Health — Do this now', lines: [] as any[] };
    blocks.push(steps);
  }

  // choose which array to append to (prefer existing lines[], else items[], else create lines[])
  let arr: any[] | null = null;
  if (Array.isArray(steps.lines)) arr = steps.lines as any[];
  else if (Array.isArray(steps.items)) arr = steps.items as any[];
  else {
    steps.lines = [];
    arr = steps.lines;
  }

  // avoid duplicates if already appended
  const marker = `Local contact (${via}): ${best.name}`;
  const already = arr.some((s) => typeof s === 'string' && s.includes(best.name));
  if (already) return blocks;

  const extras = [
    '—',
    marker,
    best.phone ? `Phone: ${best.phone}` : null,
    best.hours ? `Hours: ${best.hours}` : null,
    best.url ? `URL: ${best.url}` : null,
    best.notes ? `Notes: ${best.notes}` : null,
  ].filter(Boolean) as string[];

  arr.push(...extras);

  return blocks;
}
