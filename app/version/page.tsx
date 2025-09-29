// app/version/page.tsx
import { headers } from "next/headers";

export const dynamic = "force-dynamic"; // fine to keep/remove; helps in some envs

export default async function VersionPage() {
  // Next 15: headers() is async
  const h = await headers();

  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold mb-4">Version</h1>
      <dl className="space-y-2">
        <div>
          <dt className="font-medium">Protocol</dt>
          <dd>{proto}</dd>
        </div>
        <div>
          <dt className="font-medium">Host</dt>
          <dd>{host}</dd>
        </div>
        <div>
          <dt className="font-medium">Base URL</dt>
          <dd>{baseUrl}</dd>
        </div>
      </dl>
    </main>
  );
}
