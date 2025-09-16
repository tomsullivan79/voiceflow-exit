// app/admin/env/page.tsx
import "server-only";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function has(name: string) {
  return !!process.env[name];
}

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
];
const OPTIONAL = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_SERVICE_SID",
  "DISABLE_OUTBOUND_SMS",
];

export default async function EnvCheckPage() {
  const missing = REQUIRED.filter((n) => !has(n));
  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Environment Check (Server)</h1>

      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Variable</th>
              <th className="p-2 text-left">Present?</th>
            </tr>
          </thead>
          <tbody>
            {[...REQUIRED, ...OPTIONAL].map((name) => (
              <tr key={name} className="border-t">
                <td className="p-2 font-mono">{name}</td>
                <td className="p-2">{has(name) ? "✅" : "❌"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missing.length > 0 ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Missing required vars: {missing.join(", ")}
        </div>
      ) : (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          All required variables are present.
        </div>
      )}

      <p className="text-xs text-gray-500">
        This page tests **server runtime** only. It does not reveal values, just presence.
      </p>
    </div>
  );
}
