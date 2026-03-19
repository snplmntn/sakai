const CONTENT = "VOICE FIRST · JEEPNEY FIRST · METRO MANILA · SAKAI · ";
const REPEATED = CONTENT.repeat(4);

export default function Marquee() {
  return (
    <div
      style={{
        background: "#102033",
        borderTop: "1px solid rgba(0,122,255,0.2)",
        borderBottom: "1px solid rgba(0,122,255,0.2)",
        overflow: "hidden",
        padding: "14px 0",
      }}
    >
      {/* Row 1: scrolls left */}
      <div style={{ overflow: "hidden", marginBottom: "10px" }}>
        <div className="marquee-track-left">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1rem, 2.5vw, 1.5rem)",
              fontWeight: 700,
              color: "#ffffff",
              whiteSpace: "nowrap",
              letterSpacing: "0.05em",
            }}
          >
            {REPEATED}
          </span>
          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1rem, 2.5vw, 1.5rem)",
              fontWeight: 700,
              color: "#ffffff",
              whiteSpace: "nowrap",
              letterSpacing: "0.05em",
            }}
          >
            {REPEATED}
          </span>
        </div>
      </div>

      {/* Row 2: scrolls right */}
      <div style={{ overflow: "hidden" }}>
        <div className="marquee-track-right">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(0.75rem, 1.5vw, 1rem)",
              fontWeight: 600,
              color: "rgba(0,122,255,0.35)",
              whiteSpace: "nowrap",
              letterSpacing: "0.08em",
            }}
          >
            {REPEATED}
          </span>
          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(0.75rem, 1.5vw, 1rem)",
              fontWeight: 600,
              color: "rgba(0,122,255,0.35)",
              whiteSpace: "nowrap",
              letterSpacing: "0.08em",
            }}
          >
            {REPEATED}
          </span>
        </div>
      </div>
    </div>
  );
}
