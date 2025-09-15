import { Suspense } from "react";
import AuthClient from "./auth-client";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1>Sign in</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <AuthClient />
      </Suspense>
    </main>
  );
}
