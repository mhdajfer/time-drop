const BADGES = {
  active: { tone: "success", label: "Active" },
  scheduled: { tone: "info", label: "Scheduled" },
  expired: { tone: "neutral", label: "Expired" },
};

export function TimerStatusBadge({ status }) {
  const { tone, label } = BADGES[status];
  return <s-badge tone={tone}>{label}</s-badge>;
}
