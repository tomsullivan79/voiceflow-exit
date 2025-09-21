// app/cases/[id]/RefreshDetailClient.tsx
"use client";

import { useRouter } from "next/navigation";
import RealtimeCaseListener from "./RealtimeCaseListener";

export default function RefreshDetailClient({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  return (
    <RealtimeCaseListener
      conversationId={conversationId}
      onChange={() => router.refresh()}
      onHeartbeat={() => {}}
    />
  );
}
