'use client';

type Policy =
  | { type: 'out_of_scope'; public_message: string; referrals: any[] }
  | { type: 'org_intake'; status: 'accept'|'conditional'|'not_supported'; public_message: string | null; referrals: any[] };

export default function PolicyBanner({ policy }: { policy: Policy }) {
  if (!policy) return null;

  const tone =
    policy.type === 'out_of_scope'
      ? 'bg-blue-50 border-blue-200 text-blue-900'
      : policy.type === 'org_intake' && policy.status === 'not_supported'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-emerald-50 border-emerald-200 text-emerald-900';

  const headline =
    policy.type === 'out_of_scope'
      ? 'Not a wildlife case we can admit'
      : policy.type === 'org_intake' && policy.status === 'not_supported'
      ? 'We’re not able to admit this species'
      : 'Admission may be possible — let’s evaluate together';

  const message =
    policy.type === 'out_of_scope'
      ? policy.public_message
      : policy.public_message ?? '';

  const referrals = policy.referrals ?? [];

  return (
    <div className={`border rounded-xl p-4 mb-3 ${tone}`}>
      <div className="font-semibold mb-1">{headline}</div>
      {message && <p className="text-sm leading-relaxed whitespace-pre-line">{message}</p>}
      {referrals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {referrals.map((r: any, idx: number) => (
            <a
              key={idx}
              href={r.url || '#'}
              className="px-3 py-1 rounded-lg border bg-white text-sm hover:opacity-90"
              target={r.url ? '_blank' : undefined}
              rel="noreferrer"
              onClick={(e) => { if (!r.url && !r.phone) e.preventDefault(); }}
              title={r.phone ? `${r.label} • ${r.phone}` : r.label}
            >
              {r.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
