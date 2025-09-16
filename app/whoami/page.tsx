// app/whoami/page.tsx
"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type User = {
  id: string;
  email?: string;
};

export default function WhoAmI() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        setUser(data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null);
      } catch (e: any) {
        setError(e?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Who Am I</h1>
      {loading ? <div>Loading…</div> : null}
      {error ? <div className="text-red-600">Error: {error}</div> : null}
      {!loading && !error ? (
        user ? (
          <div className="space-y-2">
            <div className="text-green-700">Signed in ✅</div>
            <div><span className="font-medium">User ID:</span> {user.id}</div>
            <div><span className="font-medium">Email:</span> {user.email || "—"}</div>
          </div>
        ) : (
          <div className="text-gray-700">Not signed in</div>
        )
      ) : null}
    </div>
  );
}
