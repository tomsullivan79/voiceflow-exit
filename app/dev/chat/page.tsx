'use client';

import React, { useMemo, useState } from 'react';

type WTResponse = {
  ok?: boolean;
  usedLLM?: boolean;
  fallback?: string | null;
  result?: {
    blocks?: any[];
    updatedBus?: any;
  };
  error?: string;
};

const DEFAULT_BUS = JSON.stringify(
  {
    mode: 'triage',
    caller: { roles: [], zip: '55414', county: 'Hennepin County' },
    preferences: {},
    consent: {},
    animal: { species_slug: 'osprey', species_text: 'Osprey' },
    species_flags: {
      dangerous: true,
      rabies_vector: false,
      referral_required: true,
      intervention_needed: true,
      after_hours_allowed: false
    },
    triage: {},
    conversation: {},
    org: { site_code: 'WRCMN', timezone: 'America/Chicago', after_hours: false },
    system: { channel: 'web', system_time: '2025-01-01T00:00:00Z' }
  },
  null,
  2
);

// --- tiny diff helper (limited to triage/referral) ---
function flatten(obj: any, prefix = ''): Record<string, any> {
  const out: Record<string, any> = {};
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, path));
      else out[path] = v;
    }
  }
  return out;
}
function sectionDiff(before: any, after: any) {
  const a = flatten(before || {});
  const b = flatten(after || {});
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changes: Array<{ path: string; from: any; to: any }> = [];
  for (const k of keys) {
    const same = JSON.stringify(a[k]) === JSON.stringify(b[k]);
    if (!same) changes.push({ path: k, from: a[k], to: b[k] });
  }
  return changes;
}

export default function DevChatPage() {
  const [jsonText, setJsonText] = useState<string>(DEFAULT_BUS);
  const [useLLM, setUseLLM] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WTResponse | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [lastSentBus, setLastSentBus] = useState<any | null>(null);

  const endpoint = useMemo(() => (useLLM ? '/api/agent/llm' : '/api/agent/llm?force=false'), [useLLM]);

  function FallbackBadge({ type }: { type?: string | null }) {
    if (!type) return null;
    const tone =
      type === 'llm_guardrail'
        ? { bg: '#fef3c7', color: '#92400e', label: 'Guardrail' }
        : type === 'llm_timeout'
        ? { bg: '#fee2e2', color: '#7f1d1d', label: 'Timeout' }
        : { bg: '#e5e7eb', color: '#111827', label: type };
    return (
      <span className="chip" style={{ background: tone.bg, color: tone.color }}>
        fallback: {tone.label}
      </span>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);
    setRequestId(null);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError('Invalid JSON in Bus textarea. Please fix and try again.');
      return;
    }
    setLastSentBus(parsed);

    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bus: parsed })
      });
      const reqId = res.headers.get('x-request-id');
      if (reqId) setRequestId(reqId);
      const body = (await res.json()) as WTResponse;
      if (!res.ok || body?.ok === false) setError(body?.error || `Request failed with status ${res.status}`);
      setData(body);
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  const diffs = useMemo(() => {
    const before = lastSentBus || {};
    const after = data?.result?.updatedBus || {};
    const pick = (x: any) => ({ triage: x?.triage ?? {}, referral: x?.referral ?? {} });
    return {
      triage: sectionDiff(pick(before).triage, pick(after).triage),
      referral: sectionDiff(pick(before).referral, pick(after).referral)
    };
  }, [lastSentBus, data]);

  return (
    <div className="wrap">
      <div className="card">
        <h1>Dev · Minimal Chat UI</h1>
        <p className="muted">Paste/edit a <code>bus</code> JSON and submit. Toggle deterministic vs LLM.</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="label">
            Bus JSON
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              rows={16}
              className="textarea"
              aria-label="Bus JSON"
            />
          </label>

          <div className="row">
            <label className="checkbox">
              <input type="checkbox" checked={useLLM} onChange={(e) => setUseLLM(e.target.checked)} />
              <span>Use LLM (unchecked = deterministic router)</span>
            </label>
            <button type="submit" disabled={loading} className="button">{loading ? 'Sending…' : 'Send to /api/agent/llm'}</button>
          </div>
        </form>

        <div className="badges">
          {requestId && (<span className="chip chip-id">x-request-id: <code>{requestId}</code></span>)}
          <FallbackBadge type={data?.fallback} />
        </div>

        {error && <div className="error"><strong>Error:</strong> {error}</div>}

        {data && (
          <div className="result">
            <h2>Result</h2>
            <div className="kv">
              <div><span className="k">ok</span><span className="v">{String(data.ok ?? '—')}</span></div>
              <div><span className="k">usedLLM</span><span className="v">{String(data.usedLLM ?? '—')}</span></div>
              <div><span className="k">fallback</span><span className="v">{String(data.fallback ?? '—')}</span></div>
            </div>

            {/* Blocks */}
            <section className="blocks">
              <h3>blocks[]</h3>
              {data?.result?.blocks?.length ? (
                data.result.blocks.map((b: any, i: number) => (
                  <div key={i} className="block">
                    <div className="blockHead">
                      <span className="chip">{b?.type ?? 'block'}</span>
                      <strong>{b?.title ?? '(no title)'}</strong>
                    </div>

                    {typeof b?.text === 'string' && <p className="text">{b.text}</p>}

                    {/* NEW: render steps.lines and items */}
                    {Array.isArray(b?.lines) && b.lines.length > 0 && (
                      <ul className="list">
                        {b.lines.map((it: any, j: number) => (
                          <li key={j}>{typeof it === 'string' ? it : JSON.stringify(it)}</li>
                        ))}
                      </ul>
                    )}
                    {Array.isArray(b?.items) && b.items.length > 0 && (
                      <ul className="list">
                        {b.items.map((it: any, j: number) => (
                          <li key={j}>{typeof it === 'string' ? it : JSON.stringify(it)}</li>
                        ))}
                      </ul>
                    )}

                    <details className="raw">
                      <summary>Raw block</summary>
                      <pre>{JSON.stringify(b, null, 2)}</pre>
                    </details>
                  </div>
                ))
              ) : (
                <p className="muted">No blocks returned.</p>
              )}
            </section>

            {/* updatedBus */}
            <section className="updated">
              <h3>updatedBus</h3>
              {data?.result?.updatedBus ? (
                <>
                  <pre className="pre">{JSON.stringify(data.result.updatedBus, null, 2)}</pre>
                  <div className="diffs">
                    <h4>Diff — triage</h4>
                    {diffs.triage.length ? (
                      <ul className="list">
                        {diffs.triage.map((d, i) => (
                          <li key={i}><code>{d.path}</code>: <span className="del">{JSON.stringify(d.from)}</span> → <span className="ins">{JSON.stringify(d.to)}</span></li>
                        ))}
                      </ul>
                    ) : (<p className="muted">No changes in triage.</p>)}

                    <h4>Diff — referral</h4>
                    {diffs.referral.length ? (
                      <ul className="list">
                        {diffs.referral.map((d, i) => (
                          <li key={i}><code>{d.path}</code>: <span className="del">{JSON.stringify(d.from)}</span> → <span className="ins">{JSON.stringify(d.to)}</span></li>
                        ))}
                      </ul>
                    ) : (<p className="muted">No changes in referral.</p>)}
                  </div>
                </>
              ) : (
                <p className="muted">No updatedBus in response.</p>
              )}
            </section>
          </div>
        )}
      </div>

      <style jsx>{`
        .wrap { min-height: 100dvh; display: grid; place-items: start center; padding: 24px; background: var(--bg, #0b0c0d); }
        .card { width: min(100%, 980px); background: #fff; color: #111; border-radius: 18px; padding: 20px 20px 28px; box-shadow: 0 6px 24px rgba(0,0,0,0.1); }
        :global(html[data-theme='dark']) .card { background: #121416; color: #e8eaed; }
        h1 { margin: 0 0 4px; font-size: 22px; line-height: 1.2; }
        .muted { color: #6b7280; margin: 0 0 16px; }
        .form { display: grid; gap: 12px; margin-bottom: 16px; }
        .label { display: grid; gap: 8px; font-weight: 600; }
        .textarea { width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 13px; padding: 10px 12px; border-radius: 12px; border: 1px solid #e5e7eb; background: #fff; color: #111; }
        :global(html[data-theme='dark']) .textarea { background: #0f1115; color: #e8eaed; border-color: #1f2937; }
        .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .checkbox { display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .button { appearance: none; border: 0; border-radius: 12px; padding: 10px 14px; font-weight: 600; cursor: pointer; background: #6DAF75; color: white; }
        .button[disabled] { opacity: 0.6; cursor: default; }
        .badges { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 0; }
        .chip { display: inline-block; padding: 4px 8px; font-size: 12px; border-radius: 999px; background: #e5e7eb; color: #111827; }
        .chip-id code { font-size: 11px; }
        .error { margin-top: 12px; padding: 12px; border-radius: 12px; background: #fee2e2; color: #7f1d1d; border: 1px solid #fecaca; }
        .result { margin-top: 16px; }
        .kv { display: grid; grid-template-columns: 140px 1fr; row-gap: 6px; column-gap: 12px; margin: 8px 0 16px; }
        .k { color: #6b7280; } .v { font-weight: 600; }
        .blocks { margin-top: 8px; }
        .block { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin: 10px 0; background: #fafafa; }
        :global(html[data-theme='dark']) .block { background: #0f1115; border-color: #1f2937; }
        .blockHead { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .list { margin: 8px 0 0 16px; }
        .raw summary { cursor: pointer; font-size: 12px; color: #6b7280; margin-top: 8px; }
        .pre { overflow-x: auto; border-radius: 12px; border: 1px solid #e5e7eb; padding: 12px; background: #0f1115; color: #e8eaed; }
        .updated { margin-top: 16px; }
        .diffs { margin-top: 8px; }
        .del { text-decoration: line-through; opacity: 0.75; }
        .ins { font-weight: 600; }
      `}</style>
    </div>
  );
}
