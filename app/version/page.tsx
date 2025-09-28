// app/version/page.tsx
export const dynamic = "force-dynamic";

async function getVersion() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/version`, {
    cache: "no-store",
  });
  return res.json() as Promise<{ commit: string; built_at: string }>;
}

export default async function VersionPage() {
  const v = await getVersion();
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Build Version</h1>
      <div className="rounded-lg border p-4 text-sm">
        <div><span className="font-medium">Commit:</span> {v.commit}</div>
        <div><span className="font-medium">Built at:</span> {v.built_at}</div>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Source of truth for commit is <code>ASSISTANT_SNAPSHOT.md</code> (Latest human commit).
      </p>
    </main>
  );
}
