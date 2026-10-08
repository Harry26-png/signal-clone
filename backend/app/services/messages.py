"""Messages, receipts (delivered/read), reactions and disappearing-message expiry."""

import json
from collections import defaultdict
from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import ColumnElement, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..database import utcnow
from ..models import Attachment, Conversation, Message, MessageReceipt, Reaction
from ..realtime import Event
from ..schemas import MessageCreate, MessageOut, MessagePage
from . import presenters
from .errors import BadRequest, NotFound
from .membership import member_ids, require_membership

# (recipient user ids, event) pairs that the caller pushes over WebSockets after committing.
Delivery = tuple[list[int], Event]

MAX_PAGE_SIZE = 100


def not_expired(now: datetime) -> ColumnElement[bool]:
    return or_(Message.expires_at.is_(None), Message.expires_at > now)


def _with_relations(stmt):
    return stmt.options(
        selectinload(Message.reactions),
        selectinload(Message.attachment),
        selectinload(Message.reply_to).selectinload(Message.attachment),
    )


def load_messages(db: Session, message_ids: Iterable[int]) -> list[Message]:
    ids = list(message_ids)
    if not ids:
        return []
    return list(db.scalars(_with_relations(select(Message).where(Message.id.in_(ids)))))


def message_statuses(db: Session, message_ids: Iterable[int]) -> dict[int, str]:
    """Aggregate per-recipient receipts into the sender-visible status (sent / delivered / read)."""
    ids = list(message_ids)
    if not ids:
        return {}
    rows = db.execute(
        select(
            MessageReceipt.message_id,
            func.count(),
            func.count(MessageReceipt.delivered_at),
            func.count(MessageReceipt.read_at),
        )
        .where(MessageReceipt.message_id.in_(ids))
        .group_by(MessageReceipt.message_id)
    )
    statuses: dict[int, str] = {}
    for message_id, total, delivered, read in rows:
        if read == total:
            statuses[message_id] = "read"
        elif delivered == total:
            statuses[message_id] = "delivered"
        else:
            statuses[message_id] = "sent"
    return statuses


def serialize_messages(db: Session, messages: list[Message]) -> list[MessageOut]:
    statuses = message_statuses(db, (m.id for m in messages if m.kind == "text"))
    return [presenters.message_out(m, statuses.get(m.id, "sent")) for m in messages]


def list_messages(
    db: Session, user_id: int, conversation_id: int, before_id: int | None, limit: int
) -> MessagePage:
    require_membership(db, conversation_id, user_id)
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    stmt = select(Message).where(
        Message.conversation_id == conversation_id, not_expired(utcnow())
    )
    if before_id is not None:
        stmt = stmt.where(Message.id < before_id)
    rows = list(db.scalars(_with_relations(stmt.order_by(Message.id.desc()).limit(limit + 1))))
    has_more = len(rows) > limit
    page = list(reversed(rows[:limit]))
    return MessagePage(messages=serialize_messages(db, page), has_more=has_more)


def create_message(db: Session, sender_id: int, conversation_id: int, data: MessageCreate) -> Message:
    require_membership(db, conversation_id, sender_id)

    duplicate = db.scalar(
        select(Message).where(Message.sender_id == sender_id, Message.client_id == data.client_id)
    )
    if duplicate is not None:
        return load_messages(db, [duplicate.id])[0]

    body = data.body.strip()
    if not body and not data.attachment_id:
        raise BadRequest("Message cannot be empty")

    if data.attachment_id:
        attachment = db.get(Attachment, data.attachment_id)
        if attachment is None or attachment.uploader_id != sender_id:
            raise BadRequest("Invalid attachment")

    if data.reply_to_id is not None:
        quoted = db.get(Message, data.reply_to_id)
        if quoted is None or quoted.conversation_id != conversation_id:
            raise BadRequest("Cannot reply to that message")

    conversation = db.get(Conversation, conversation_id)
    now = utcnow()
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        kind="text",
        body=body,
        client_id=data.client_id,
        reply_to_id=data.reply_to_id,
        attachment_id=data.attachment_id,
        created_at=now,
        expires_at=(
            now + timedelta(seconds=conversation.disappearing_seconds)
            if conversation.disappearing_seconds
            else None
        ),
    )
    message.receipts = [
        MessageReceipt(user_id=uid) for uid in member_ids(db, conversation_id) if uid != sender_id
    ]
    db.add(message)
    conversation.last_activity_at = now
    try:
        db.commit()
    except IntegrityError:
        # A concurrent retry with the same client_id was stored first (UNIQUE sender_id, client_id).
        db.rollback()
        existing = db.scalar(
            select(Message.id).where(Message.sender_id == sender_id, Message.client_id == data.client_id)
        )
        if existing is None:
            raise
        return load_messages(db, [existing])[0]
    return load_messages(db, [message.id])[0]


def add_system_message(
    db: Session, conversation: Conversation, actor_id: int | None, payload: dict[str, Any]
) -> Message:
    """Timeline event such as 'Alice added Bob'. Stored as JSON so each client can phrase it ('You added...')."""
    now = utcnow()
    message = Message(
        conversation_id=conversation.id,
        sender_id=actor_id,
        kind="system",
        body=json.dumps(payload),
        created_at=now,
    )
    db.add(message)
    conversation.last_activity_at = now
    return message


def new_message_delivery(db: Session, message: Message) -> Delivery:
    [dto] = serialize_messages(db, load_messages(db, [message.id]))
    return member_ids(db, message.conversation_id), {
        "type": "message.new",
        "message": dto.model_dump(mode="json"),
    }


# ---------- Receipts ----------


def _status_deliveries(db: Session, message_ids: list[int]) -> list[Delivery]:
    """Tell each sender the new aggregate status of their affected messages."""
    if not message_ids:
        return []
    statuses = message_statuses(db, message_ids)
    rows = db.execute(
        select(Message.id, Message.sender_id, Message.conversation_id).where(
            Message.id.in_(message_ids)
        )
    )
    updates_by_sender: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for message_id, sender_id, conversation_id in rows:
        if sender_id is not None:
            updates_by_sender[sender_id].append(
                {
                    "message_id": message_id,
                    "conversation_id": conversation_id,
                    "status": statuses.get(message_id, "sent"),
                }
            )
    return [
        ([sender_id], {"type": "message.status", "updates": updates})
        for sender_id, updates in updates_by_sender.items()
    ]


def mark_delivered(db: Session, user_id: int, message_ids: list[int] | None = None) -> list[Delivery]:
    """Mark messages as delivered to `user_id`. With no ids, everything pending (used on connect)."""
    stmt = select(MessageReceipt).where(
        MessageReceipt.user_id == user_id, MessageReceipt.delivered_at.is_(None)
    )
    if message_ids is not None:
        if not message_ids:
            return []
        stmt = stmt.where(MessageReceipt.message_id.in_(message_ids))
    receipts = list(db.scalars(stmt))
    if not receipts:
        return []
    now = utcnow()
    for receipt in receipts:
        receipt.delivered_at = now
    db.commit()
    return _status_deliveries(db, [r.message_id for r in receipts])


def mark_read(db: Session, user_id: int, conversation_id: int) -> list[Delivery]:
    require_membership(db, conversation_id, user_id)
    receipts = list(
        db.scalars(
            select(MessageReceipt)
            .join(Message, Message.id == MessageReceipt.message_id)
            .where(
                MessageReceipt.user_id == user_id,
                MessageReceipt.read_at.is_(None),
                Message.conversation_id == conversation_id,
            )
        )
    )
    deliveries: list[Delivery] = [
        ([user_id], {"type": "conversation.read", "conversation_id": conversation_id})
    ]
    if not receipts:
        return deliveries
    now = utcnow()
    for receipt in receipts:
        receipt.read_at = now
        receipt.delivered_at = receipt.delivered_at or now
    db.commit()
    return deliveries + _status_deliveries(db, [r.message_id for r in receipts])


# ---------- Reactions ----------


def _reaction_delivery(db: Session, message: Message) -> Delivery:
    reactions = db.scalars(select(Reaction).where(Reaction.message_id == message.id))
    return member_ids(db, message.conversation_id), {
        "type": "message.reactions",
        "conversation_id": message.conversation_id,
        "message_id": message.id,
        "reactions": [{"user_id": r.user_id, "emoji": r.emoji} for r in reactions],
    }


def _reactable_message(db: Session, user_id: int, message_id: int) -> Message:
    message = db.get(Message, message_id)
    if message is None or message.kind != "text":
        raise NotFound("Message not found")
    require_membership(db, message.conversation_id, user_id)
    return message


def set_reaction(db: Session, user_id: int, message_id: int, emoji: str) -> Delivery:
    message = _reactable_message(db, user_id, message_id)
    reaction = db.get(Reaction, (message_id, user_id))
    if reaction is None:
        db.add(Reaction(message_id=message_id, user_id=user_id, emoji=emoji))
    else:
        reaction.emoji = emoji
        reaction.created_at = utcnow()
    db.commit()
    return _reaction_delivery(db, message)


def remove_reaction(db: Session, user_id: int, message_id: int) -> Delivery:
    message = _reactable_message(db, user_id, message_id)
    db.execute(delete(Reaction).where(Reaction.message_id == message_id, Reaction.user_id == user_id))
    db.commit()
    return _reaction_delivery(db, message)


# ---------- Disappearing messages ----------


def purge_expired(db: Session) -> list[Delivery]:
    expired = db.execute(
        select(Message.id, Message.conversation_id).where(Message.expires_at <= utcnow())
    ).all()
    if not expired:
        return []
    by_conversation: dict[int, list[int]] = defaultdict(list)
    for message_id, conversation_id in expired:
        by_conversation[conversation_id].append(message_id)
    # Receipts and reactions go with ON DELETE CASCADE; quoting replies get reply_to_id = NULL.
    db.execute(delete(Message).where(Message.id.in_([mid for mid, _ in expired])))
    db.commit()
    return [
        (
            member_ids(db, conversation_id),
            {"type": "message.deleted", "conversation_id": conversation_id, "message_ids": ids},
        )
        for conversation_id, ids in by_conversation.items()
    ]
