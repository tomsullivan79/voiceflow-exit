// app/auth/page.tsx
import { Suspense } from "react";
import AuthClient from "./auth-client";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <AuthClient />
      </Suspense>
    </main>
  );
}
