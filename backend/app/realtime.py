"""In-memory registry of open WebSocket connections and fan-out helpers.

A user may have several sockets open (multiple tabs/devices). Presence is "online" while at
least one socket is connected. This is single-process state; scaling horizontally would need a
pub/sub backplane (e.g. Redis), which is out of scope for this assignment.
"""

import asyncio
import logging
from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

Event = dict[str, Any]


class ConnectionManager:
    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = defaultdict(set)

    def connect(self, user_id: int, websocket: WebSocket) -> bool:
        """Register a socket. Returns True if this is the user's first open connection."""
        first = not self._sockets[user_id]
        self._sockets[user_id].add(websocket)
        return first

    def disconnect(self, user_id: int, websocket: WebSocket) -> bool:
        """Unregister a socket. Returns True if the user has no connections left."""
        sockets = self._sockets.get(user_id)
        if sockets is None:
            return True
        sockets.discard(websocket)
        if not sockets:
            del self._sockets[user_id]
            return True
        return False

    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))

    async def send_to_users(self, user_ids: Iterable[int], event: Event) -> None:
        targets = [ws for uid in set(user_ids) for ws in list(self._sockets.get(uid, ()))]
        if targets:
            await asyncio.gather(*(self._safe_send(ws, event) for ws in targets))

    async def send_many(self, deliveries: Iterable[tuple[Iterable[int], Event]]) -> None:
        for user_ids, event in deliveries:
            await self.send_to_users(user_ids, event)

    @staticmethod
    async def _safe_send(websocket: WebSocket, event: Event) -> None:
        try:
            await websocket.send_json(event)
        except Exception:  # noqa: BLE001 - a dead socket must not break fan-out to others
            logger.debug("Dropping event for closed socket", exc_info=True)


manager = ConnectionManager()
