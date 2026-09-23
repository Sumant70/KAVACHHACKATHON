import React from "react";

export default function KavachLogo({ size = "default", compact = false, showTagline = true }) {
  const isSmall = size === "small";
  const iconSize = isSmall ? 32 : compact ? 36 : 44;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: isSmall ? 8 : 12, userSelect: "none" }}>
      {/* Tactical Emblem: Shield + Wildlife Silhouette + Crosshair */}
      <div
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: 8,
          background: "linear-gradient(135deg, #183828 0%, #0d2217 60%, #08150f 100%)",
          border: "1.5px solid #2e6648",
          boxShadow: "0 0 16px rgba(46, 102, 72, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0
        }}
      >
        <svg
          width={iconSize * 0.72}
          height={iconSize * 0.72}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fortified Outer Shield */}
          <path
            d="M24 4L8 10V22C8 32.5 14.8 42.2 24 44C33.2 42.2 40 32.5 40 22V10L24 4Z"
            stroke="#4F8A64"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="rgba(31, 69, 49, 0.3)"
          />
          {/* Inner Target Crosshairs */}
          <circle cx="24" cy="23" r="11" stroke="#D6A84F" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="24" y1="9" x2="24" y2="13" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />
          <line x1="24" y1="33" x2="24" y2="37" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="23" x2="14" y2="23" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />
          <line x1="34" y1="23" x2="38" y2="23" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />

          {/* Wildlife Silhouette (Tiger Head / Feline Crest) */}
          <path
            d="M17 19L19 23L22 22L24 25L26 22L29 23L31 19C29 17 26 16 24 16C22 16 19 17 17 19Z"
            fill="#EAF2EC"
          />
          <path
            d="M20 25C20 28 22 30 24 30C26 30 28 28 28 25L24 27L20 25Z"
            fill="#D6A84F"
          />
          {/* GPS Center Point */}
          <circle cx="24" cy="23" r="1.5" fill="#4F8A64" />
        </svg>

        {/* Tactical Corner Marks */}
        <div style={{ position: "absolute", top: 2, left: 2, width: 4, height: 4, borderTop: "1px solid #D6A84F", borderLeft: "1px solid #D6A84F" }} />
        <div style={{ position: "absolute", bottom: 2, right: 2, width: 4, height: 4, borderBottom: "1px solid #D6A84F", borderRight: "1px solid #D6A84F" }} />
      </div>

      {/* Brand Typography */}
      {!compact && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 800,
                fontSize: isSmall ? 18 : 22,
                letterSpacing: "0.14em",
                color: "#EEF4EE",
                textShadow: "0 0 12px rgba(79, 138, 100, 0.4)",
                lineHeight: 1
              }}
            >
              KAVACH
            </span>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9.5,
                fontWeight: 700,
                color: "#D6A84F",
                background: "rgba(214, 168, 79, 0.15)",
                border: "1px solid rgba(214, 168, 79, 0.35)",
                padding: "1px 5px",
                borderRadius: 3,
                letterSpacing: "0.08em"
              }}
            >
              v2.0 PRO
            </span>
          </div>

          {showTagline && (
            <span
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 10,
                color: "#8FA396",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: 3
              }}
            >
              AI Wildlife Detection & Early Warning
            </span>
          )}
        </div>
      )}
    </div>
  );
}
