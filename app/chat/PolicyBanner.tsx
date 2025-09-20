// app/chat/PolicyBanner.tsx
"use client";

import * as React from "react";

type Referral = {
  type: string;
  label: string;
  url?: string | null;
};

type OrgIntakeStatus = "supported" | "conditional" | "not_supported" | "paused" | "unknown";

type Policy =
  | {
      type: "out_of_scope";
      public_message: string;
      referrals?: Referral[];
    }
  | {
      type: "org_intake";
      status: OrgIntakeStatus;
      public_message: string;
      referrals?: Referral[];
    };

export default function PolicyBanner(props: {
  speciesSlug?: string | null;
  policy?: Policy | null;
}) {
  const { speciesSlug, policy } = props;

  // Relaxed guard: render if we have a policy with a type.
  if (!policy || !("type" in policy)) return null;

  // Inline colors so the banner is visible even if stylesheet hiccups.
  let bg = "#eef2ff";
  let border = "#c7d2fe";
  let title = "Species Policy";
  let chipText = "";

  if (policy.type === "out_of_scope") {
    // Blue
    bg = "#eff6ff";
    border = "#bae6fd";
    title = "Out-of-Scope Species";
    chipText = "Out of scope";
  } else if (policy.type === "org_intake") {
    switch (policy.status) {
      case "not_supported":
        // Amber
        bg = "#fffbeb";
        border = "#fde68a";
        chipText = "Not supported";
        title = "Intake Policy";
        break;
      case "conditional":
      case "supported":
        // Green
        bg = "#ecfdf5";
        border = "#a7f3d0";
        chipText = policy.status === "conditional" ? "Conditional" : "Supported";
        title = "Intake Policy";
        break;
      default:
        // Gray
        bg = "#f3f4f6";
        border = "#e5e7eb";
        chipText = "Status unknown";
        title = "Intake Policy";
        break;
    }
  }

  const SpeciesLabel = speciesSlug
    ? speciesSlug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Species";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        padding: "12px 14px",
        borderRadius: 12,
        marginTop: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: 14, letterSpacing: 0.3 }}>{title}</strong>
        {chipText ? (
          <span
            style={{
              fontSize: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              padding: "2px 8px",
              borderRadius: 999,
              lineHeight: 1.6,
            }}
            aria-label={`Policy status: ${chipText}`}
          >
            {chipText}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 14, marginBottom: 6 }}>
        <em style={{ opacity: 0.8 }}>{SpeciesLabel}</em>
      </div>

      <p style={{ fontSize: 14, margin: "4px 0 8px 0" }}>
        {"public_message" in policy ? policy.public_message : ""}
      </p>

      {Array.isArray(policy.referrals) && policy.referrals.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Suggested next steps</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {policy.referrals.map((r, idx) => {
              const label = r.label || r.type;
              const hasUrl = typeof r.url === "string" && r.url.length > 0;
              return (
                <li key={idx} style={{ fontSize: 13, marginBottom: 4 }}>
                  {hasUrl ? (
                    <a href={r.url!} target="_blank" rel="noreferrer">
                      {label}
                    </a>
                  ) : (
                    label
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
