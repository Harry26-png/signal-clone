import type { MessageStatus } from "@/lib/types";

const LABELS: Record<MessageStatus, string> = {
  sending: "Sending",
  failed: "Failed to send",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
};

/**
 * Signal's delivery indicators:
 *  sending   – dashed circle
 *  sent      – one outlined circle with a check
 *  delivered – two overlapping outlined circles with checks
 *  read      – two overlapping filled circles with checks
 * `knockout` is the colour drawn "through" the filled circles (the bubble background).
 */
export function MessageStatusIcon({
  status,
  knockout = "var(--bg-pane)",
  size = 14,
}: {
  status: MessageStatus;
  knockout?: string;
  size?: number;
}) {
  const common = { width: size * (status === "delivered" || status === "read" ? 18 / 12 : 1), height: size };
  if (status === "failed") {
    return (
      <svg {...common} viewBox="0 0 12 12" aria-label={LABELS.failed} role="img">
        <circle cx="6" cy="6" r="5.25" fill="var(--danger)" />
        <path d="M6 3.2v3.4M6 8.4v.2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "sending") {
    return (
      <svg {...common} viewBox="0 0 12 12" aria-label={LABELS.sending} role="img">
        <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2 1.7" />
      </svg>
    );
  }
  const check = (x: number, color: string) => (
    <path
      d={`M${x - 2.1} 6.1l1.45 1.45 2.8-2.9`}
      fill="none"
      stroke={color}
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  if (status === "sent") {
    return (
      <svg {...common} viewBox="0 0 12 12" aria-label={LABELS.sent} role="img">
        <circle cx="6" cy="6" r="4.9" fill="none" stroke="currentColor" strokeWidth="1.1" />
        {check(6, "currentColor")}
      </svg>
    );
  }
  const filled = status === "read";
  return (
    <svg {...common} viewBox="0 0 18 12" aria-label={LABELS[status]} role="img">
      <circle
        cx="6"
        cy="6"
        r="4.9"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.1"
      />
      {check(6, filled ? knockout : "currentColor")}
      {/* Second circle sits on top; a knockout stroke separates it from the first. */}
      <circle cx="12" cy="6" r="5.45" fill={knockout} />
      <circle
        cx="12"
        cy="6"
        r="4.9"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.1"
      />
      {check(12, filled ? knockout : "currentColor")}
    </svg>
  );
}
