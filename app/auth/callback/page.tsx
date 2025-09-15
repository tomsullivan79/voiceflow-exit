import { Suspense } from "react";
import CallbackClient from "./callback-client";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1>Signing you in…</h1>
      <Suspense fallback={<p>Preparing session…</p>}>
        <CallbackClient />
      </Suspense>
    </main>
  );
}
