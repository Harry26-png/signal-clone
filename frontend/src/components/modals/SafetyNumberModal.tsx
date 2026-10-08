"use client";

import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { useConversation } from "@/hooks/selectors";
import { mockSafetyNumber, otherMember } from "@/lib/conversation";
import { useChatStore } from "@/store/chat";
import { useSessionStore } from "@/store/session";
import { toast } from "@/store/ui";
import styles from "./modals.module.css";

/** Deterministic pseudo-QR pattern derived from the safety number (decorative only). */
function PseudoQr({ seed }: { seed: string }) {
  const size = 21;
  const cells: boolean[] = [];
  let h = 0;
  for (let i = 0; i < size * size; i++) {
    h = (h * 31 + seed.charCodeAt(i % seed.length) + i) >>> 0;
    cells.push(h % 3 === 0);
  }
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  return (
    <svg className={styles.qr} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
      {cells.map((on, i) => {
        const x = i % size;
        const y = Math.floor(i / size);
        if (finder(x, y)) return null;
        return on ? <rect key={i} x={x} y={y} width="1" height="1" fill="#000" /> : null;
      })}
      {[
        [0, 0],
        [size - 7, 0],
        [0, size - 7],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width="6" height="6" fill="none" stroke="#000" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#000" />
        </g>
      ))}
    </svg>
  );
}

export function SafetyNumberModal({ conversationId, onClose }: { conversationId: number; onClose: () => void }) {
  const conversation = useConversation(conversationId);
  const me = useSessionStore((s) => s.me);
  const users = useChatStore((s) => s.users);
  const other = conversation && me ? otherMember(conversation, me.id, users) : undefined;
  if (!other || !me) return null;
  const groups = mockSafetyNumber(me, other);

  return (
    <Modal
      title="Safety number"
      onClose={onClose}
      footer={
        <Button
          onClick={() => {
            toast(`Marked ${other.display_name} as verified`);
            onClose();
          }}
        >
          Mark as verified
        </Button>
      }
    >
      <PseudoQr seed={groups.join("")} />
      <div className={styles.safety}>
        {groups.map((g, i) => (
          <span key={i}>{g}</span>
        ))}
      </div>
      <p className={styles.text}>
        To verify the security of your end-to-end encryption with {other.display_name}, compare the numbers above with
        their device. Encryption is simulated in this demo, so this number is illustrative.
      </p>
    </Modal>
  );
}
