"""Real-time channel.

Server -> client events:
  message.new, message.status, message.reactions, message.deleted,
  conversation.updated, conversation.removed, conversation.read,
  typing, presence, user.updated, pong

Client -> server events:
  {"type": "typing", "conversation_id": int, "is_typing": bool}
  {"type": "delivered", "message_ids": [int, ...]}
  {"type": "ping"}

Sending messages and marking chats read go through REST so they get validation and a response.
"""

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from ..database import SessionLocal
from ..realtime import manager
from ..services import messages as message_service
from ..services import users as user_service
from ..services.errors import ServiceError
from ..services.membership import member_ids, require_membership

router = APIRouter()
logger = logging.getLogger(__name__)

UNAUTHORIZED_CLOSE_CODE = 4401


def _authenticate(token: str) -> int | None:
    with SessionLocal() as db:
        user = user_service.user_for_token(db, token)
        return user.id if user else None


def _on_connect(user_id: int, first_connection: bool):
    with SessionLocal() as db:
        # Coming online means every queued message has now reached this device.
        deliveries = message_service.mark_delivered(db, user_id)
        if first_connection:
            deliveries.append(user_service.presence_delivery(db, user_id, online=True))
        return deliveries


def _on_disconnect(user_id: int):
    with SessionLocal() as db:
        user_service.touch_last_seen(db, user_id)
        return [user_service.presence_delivery(db, user_id, online=False)]


def _typing(user_id: int, conversation_id: int, is_typing: bool):
    with SessionLocal() as db:
        require_membership(db, conversation_id, user_id)
        others = [uid for uid in member_ids(db, conversation_id) if uid != user_id]
    return [
        (
            others,
            {
                "type": "typing",
                "conversation_id": conversation_id,
                "user_id": user_id,
                "is_typing": is_typing,
            },
        )
    ]


def _delivered(user_id: int, message_ids: list[int]):
    with SessionLocal() as db:
        return message_service.mark_delivered(db, user_id, message_ids)


async def _handle(websocket: WebSocket, user_id: int, data: dict) -> None:
    kind = data.get("type")
    if kind == "ping":
        await websocket.send_json({"type": "pong"})
    elif kind == "typing":
        deliveries = await run_in_threadpool(
            _typing, user_id, int(data["conversation_id"]), bool(data.get("is_typing"))
        )
        await manager.send_many(deliveries)
    elif kind == "delivered":
        ids = [int(i) for i in data.get("message_ids", [])][:500]
        await manager.send_many(await run_in_threadpool(_delivered, user_id, ids))


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Browsers cannot set headers on WebSocket requests, so the session token comes in the query string.
    user_id = await run_in_threadpool(_authenticate, token)
    if user_id is None:
        await websocket.close(code=UNAUTHORIZED_CLOSE_CODE)
        return

    await websocket.accept()
    first = manager.connect(user_id, websocket)
    try:
        await manager.send_many(await run_in_threadpool(_on_connect, user_id, first))
        while True:
            data = await websocket.receive_json()
            try:
                await _handle(websocket, user_id, data)
            except (ServiceError, KeyError, TypeError, ValueError) as exc:
                await websocket.send_json({"type": "error", "detail": str(exc)})
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        logger.exception("WebSocket error for user %s", user_id)
    finally:
        if manager.disconnect(user_id, websocket):
            await manager.send_many(await run_in_threadpool(_on_disconnect, user_id))
