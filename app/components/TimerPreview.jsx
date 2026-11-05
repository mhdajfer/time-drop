import { DEFAULT_MESSAGE } from "../utils/timer";

const SIZES = {
  small: { message: 13, digits: 20 },
  medium: { message: 15, digits: 28 },
  large: { message: 17, digits: 36 },
};

const SEGMENTS = [
  ["02", "Days"],
  ["14", "Hours"],
  ["05", "Minutes"],
  ["33", "Seconds"],
];

export function TimerPreview({ values }) {
  const size = SIZES[values.size] ?? SIZES.medium;

  return (
    <div
      style={{
        background: values.backgroundColor,
        color: values.textColor,
        borderRadius: 8,
        padding: "12px 16px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: size.message, marginBottom: 8 }}>
        {values.description || DEFAULT_MESSAGE}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
        {SEGMENTS.map(([value, label]) => (
          <div key={label}>
            <div
              style={{
                fontSize: size.digits,
                fontWeight: 700,
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
