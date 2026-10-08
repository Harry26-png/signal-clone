import { WS_URL } from "./api";
import type { ClientEvent, ServerEvent } from "./types";

export type ConnectionState = "connecting" | "open" | "offline";

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;
const UNAUTHORIZED_CLOSE_CODE = 4401;

interface Handlers {
  onEvent: (event: ServerEvent) => void;
  onStateChange: (state: ConnectionState) => void;
  /** Fired after a reconnect so the app can refetch anything missed while offline. */
  onReconnect: () => void;
  onUnauthorized: () => void;
}

/** WebSocket wrapper with heartbeat and exponential-backoff reconnection. */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  private hasConnected = false;
  private closedByUser = false;

  constructor(
    private token: string,
    private handlers: Handlers,
  ) {}

  connect() {
    this.closedByUser = false;
    this.handlers.onStateChange("connecting");
    const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(this.token)}`);
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.handlers.onStateChange("open");
      if (this.hasConnected) this.handlers.onReconnect();
      this.hasConnected = true;
      this.heartbeat = setInterval(() => this.send({ type: "ping" }), HEARTBEAT_MS);
    };
    socket.onmessage = (message) => {
      try {
        this.handlers.onEvent(JSON.parse(message.data) as ServerEvent);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = (event) => {
      clearInterval(this.heartbeat);
      if (this.socket !== socket || this.closedByUser) return;
      if (event.code === UNAUTHORIZED_CLOSE_CODE) {
        this.handlers.onUnauthorized();
        return;
      }
      this.handlers.onStateChange("offline");
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempts++);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  send(event: ClientEvent) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event));
  }

  close() {
    this.closedByUser = true;
    clearInterval(this.heartbeat);
    clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = null;
  }
}
