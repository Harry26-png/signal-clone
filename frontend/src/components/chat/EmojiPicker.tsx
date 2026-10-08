"use client";

import { useEffect, useRef } from "react";
import styles from "./chat.module.css";

const EMOJI =
  "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😴 😷 🤒 🤕 🥵 🥶 😎 🤓 🧐 😕 😟 😮 😲 😳 🥺 😢 😭 😱 😤 😡 🤯 🥳 👍 👎 👏 🙌 🙏 🤝 💪 👋 ✌️ 🤞 👌 🤙 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 ✨ 🔥 🎉 🎂 ☕ 🍕 🥪 🏔️ 🥾 🌿 🚗 ✅ ❌ 👀 💯".split(
    " ",
  );

export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Defer so the click that opened the picker doesn't immediately close it.
    const timer = setTimeout(() => document.addEventListener("mousedown", onDown));
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return (
    <div className={styles.emojiPicker} ref={root} role="dialog" aria-label="Emoji">
      <p className={styles.emojiTitle}>Emoji</p>
      <div className={styles.emojiGrid}>
        {EMOJI.map((emoji) => (
          <button key={emoji} type="button" onClick={() => onPick(emoji)} aria-label={emoji}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
