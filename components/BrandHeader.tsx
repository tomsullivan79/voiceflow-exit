// components/BrandHeader.tsx
"use client";

/**
 * WRC Sage Brand Header
 * - Uses your existing brand: "UCity Pro", primary #6DAF75, Green_Sage.png
 * - Centered banner with avatar, title, subtitle
 * - Self-contained styles (no global/Tailwind required)
 */

export default function BrandHeader({
  title = "Sage",
  subtitle = "Wildlife Triage Agent",
  imageSrc = "/Green_Sage.png",
}: {
  title?: string;
  subtitle?: string;
  imageSrc?: string;
}) {
  return (
    <div className="sage-banner" role="banner" aria-label="Sage Header">
      <div className="sage-wrap">
        <img
          src={imageSrc}
          alt="Sage agent"
          width={56}
          height={56}
          className="sage-avatar"
        />
        <div className="sage-text">
          <h1 className="sage-title">{title}</h1>
          {subtitle ? <p className="sage-sub">{subtitle}</p> : null}
        </div>
      </div>

      <style jsx>{`
        /* Brand tokens from your palette */
        :root {
          --sage-50:  #EFF6EF;
          --sage-100: #DEEDE0;
          --sage-200: #BDDBC1;
          --sage-300: #9CC9A2;
          --sage-400: #7BBB82;
          --sage-500: #5AA563; /* close to VF button look */
          --sage-600: #48844F;
          --sage-700: #36633C;
          --sage-800: #244228;
          --sage-900: #122114;
          --sage-primary: #6DAF75; /* Voiceflow primary color provided */
          --sage-text-dark: #0a0a0a;
          --sage-text-light: #f5f5f5;
        }

        .sage-banner {
          border-radius: 16px;
          background: var(--sage-primary);
          color: white;
          padding: 14px 16px;
          /* subtle depth like VF widget */
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        .sage-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sage-avatar {
          display: block;
          width: 56px;
          height: 56px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.85);
          padding: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }

        .sage-text {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }

        .sage-title {
          margin: 0;
          font-family: "UCity Pro", ui-sans-serif, system-ui, -apple-system, Segoe UI,
            Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .sage-sub {
          margin: 4px 0 0 0;
          font-family: "UCity Pro", ui-sans-serif, system-ui, -apple-system, Segoe UI,
            Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
          font-size: 13px;
          opacity: 0.95;
        }

        @media (prefers-color-scheme: dark) {
          .sage-title,
          .sage-sub {
            color: var(--sage-50);
          }
        }
      `}</style>
    </div>
  );
}
