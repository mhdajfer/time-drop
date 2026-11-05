import { DEFAULT_MESSAGE } from "../utils/timer";

// Mirrors the storefront widget (extensions/countdown-timer/assets/countdown-timer.css),
// so merchants see what shoppers will see.
const DIGIT_SIZES = { small: 20, medium: 26, large: 32 };

const SEGMENTS = [
  ["02", "Days"],
  ["14", "Hours"],
  ["05", "Mins"],
  ["33", "Secs"],
];

export function TimerPreview({ values }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 96,
        padding: "12px 16px",
        borderRadius: 8,
        overflow: "hidden",
        textAlign: "center",
        background: values.backgroundColor,
        color: values.textColor,
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          fontSize: 14,
          lineHeight: "18px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {values.description || DEFAULT_MESSAGE}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {SEGMENTS.map(([value, label]) => (
          <div
            key={label}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: "2.2em" }}
          >
            <span
              style={{
                fontSize: DIGIT_SIZES[values.size] ?? DIGIT_SIZES.medium,
                fontWeight: 700,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </span>
            <span
              style={{
                fontSize: 10,
                lineHeight: "12px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
