// app/cases/RefreshListClient.tsx
"use client";

import { useRouter } from "next/navigation";
import RealtimeCasesListListener from "./RealtimeCasesListListener";

export default function RefreshListClient() {
  const router = useRouter();
  return (
    <RealtimeCasesListListener
      onChange={() => router.refresh()}
      onHeartbeatStart={() => {}}
      onHeartbeatStop={() => {}}
    />
  );
}
