import { publicHealthLookup } from '@/lib/tools/publicHealthLookup';

type Block = {
  type?: string;
  title?: string;
  text?: string;
  items?: Array<string | any>;
  [k: string]: any;
};

type BusLike = {
  caller?: { zip?: string; county?: string };
  triage?: { decision?: string };
};

/**
 * If triage.decision === 'dispatch', append public health contact lines to the first steps block.
 * Non-destructive: if no match or not dispatch, returns blocks unchanged.
 */
export async function enrichDispatchSteps(
  blocks: Block[] = [],
  bus: BusLike | undefined
): Promise<Block[]> {
  const decision = bus?.triage?.decision;
  if (decision !== 'dispatch') return blocks;

  const zip = bus?.caller?.zip;
  const county = bus?.caller?.county;

  // Lookup best local contact (zip preferred, county fallback)
  const { best, via } = await publicHealthLookup({ zip, county });
  if (!best) return blocks;

  // Find (or create) steps block
  let steps = blocks.find((b) => b?.type === 'steps');
  if (!steps) {
    steps = { type: 'steps', title: 'Public Health — Do this now', items: [] };
    blocks.push(steps);
  }
  if (!Array.isArray(steps.items)) steps.items = [];

  // Compose readable lines to add under “Contact your local …”
  const lineMain = `Local contact (${via}): ${best.name}`;
  const linePhone = best.phone ? `Phone: ${best.phone}` : null;
  const lineHours = best.hours ? `Hours: ${best.hours}` : null;
  const lineUrl = best.url ? `URL: ${best.url}` : null;
  const lineNotes = best.notes ? `Notes: ${best.notes}` : null;

  // Insert as a small group so they stay together
  steps.items.push('—', lineMain);
  if (linePhone) steps.items.push(linePhone);
  if (lineHours) steps.items.push(lineHours);
  if (lineUrl) steps.items.push(lineUrl);
  if (lineNotes) steps.items.push(lineNotes);

  return blocks;
}
