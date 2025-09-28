// app/version/page.tsx
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function getVersion() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("Host header missing");
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/version`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load version: ${res.status}`);
  return (await res.json()) as { commit: string; built_at: string };
}

export default async function VersionPage() {
  const v = await getVersion();
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Build Version</h1>
      <div className="rounded-lg border p-4 text-sm">
        <div>
          <span className="font-medium">Commit:</span> {v.commit}
        </div>
        <div>
          <span className="font-medium">Built at:</span> {v.built_at}
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Source of truth for commit is <code>ASSISTANT_SNAPSHOT.md</code> (Latest
        human commit).
      </p>
    </main>
  );
}
