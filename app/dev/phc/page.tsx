'use client';

import React, { useEffect, useState } from 'react';

type Row = {
  id: string;
  region_type: 'zip' | 'county';
  region_value: string;
  name: string;
  phone: string | null;
  url: string | null;
  hours: string | null;
  notes: string | null;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export default function PHCListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch('/api/dev/phc/list?limit=200', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!aborted) {
          setRows(json.rows ?? []);
        }
      } catch (e: any) {
        if (!aborted) setErr(e?.message || 'Load failed');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  return (
    <div className="wrap">
      <div className="card">
        <h1>Dev · Public-Health Contacts</h1>
        <p className="muted">Read-only list from <code>public_health_contacts</code>.</p>

        {loading && <p className="muted">Loading…</p>}
        {err && <div className="error">Error: {err}</div>}

        {!loading && !err && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>URL</th>
                  <th>Hours</th>
                  <th>Notes</th>
                  <th>Priority</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="muted">No contacts found.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="mono">{r.region_type}</span> · {r.region_value}</td>
                    <td>{r.name}</td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a> : '—'}</td>
                    <td>{r.hours || '—'}</td>
                    <td className="notes">{r.notes || '—'}</td>
                    <td>{r.priority}</td>
                    <td><span className={`badge ${r.active ? 'on' : 'off'}`}>{r.active ? 'Yes' : 'No'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      <style jsx>{`
        .wrap { min-height: 100dvh; display: grid; place-items: start center; padding: 24px; background: var(--bg, #0b0c0d); }
        .card { width: min(100%, 980px); background: #fff; color: #111; border-radius: 18px; padding: 20px 20px 28px; box-shadow: 0 6px 24px rgba(0,0,0,0.1); }
        :global(html[data-theme='dark']) .card { background: #121416; color: #e8eaed; }
        h1 { margin: 0 0 4px; font-size: 22px; line-height: 1.2; }
        .muted { color: #6b7280; margin: 0 0 16px; }
        .error { margin: 12px 0; padding: 10px 12px; border-radius: 12px; background: #fee2e2; color: #7f1d1d; border: 1px solid #fecaca; }
        .tableWrap { overflow-x: auto; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        thead th { position: sticky; top: 0; background: #f9fafb; }
        :global(html[data-theme='dark']) thead th { background: #0f1115; border-color: #1f2937; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; color: #6b7280; }
        .notes { max-width: 360px; }
        .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
        .badge.on { background: #e6f6ea; color: #065f46; }
        .badge.off { background: #fee2e2; color: #7f1d1d; }
      `}</style>
    </div>
  );
}
